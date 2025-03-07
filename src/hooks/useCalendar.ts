import { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarConfig, Week, WeekCustomization } from '../types/calendar';
import { CalendarService } from '../services/CalendarService';
import { generateWeeksWithCustomizations, startOfDay } from '../utils/dates';

interface UseCalendarOptions {
    startDate: Date;
    endDate: Date;
    isAdminMode?: boolean;
}

interface UseCalendarReturn {
    weeks: Week[];
    selectedWeeks: Week[];
    customizations: WeekCustomization[];
    config: CalendarConfig | null;
    isLoading: boolean;
    error: Error | null;
    setSelectedWeeks: (weeks: Week[]) => void;
    // Actions
    selectWeek: (week: Week) => void;
    clearSelection: () => void;
    // Admin actions
    createCustomization: (customization: Omit<WeekCustomization, 'id' | 'createdAt' | 'createdBy'>) => Promise<WeekCustomization | null>;
    updateCustomization: (id: string, updates: Partial<Omit<WeekCustomization, 'id' | 'createdAt' | 'createdBy'>>) => Promise<WeekCustomization | null>;
    deleteCustomization: (id: string) => Promise<boolean>;
    updateConfig: (updates: Partial<Omit<CalendarConfig, 'id' | 'createdAt'>>) => Promise<CalendarConfig | null>;
    // Added to allow external refresh control
    setLastRefresh: React.Dispatch<React.SetStateAction<number>>;
}

export function useCalendar({ startDate, endDate, isAdminMode = false }: UseCalendarOptions): UseCalendarReturn {
    // Normalize dates to ensure consistent handling
    const normalizedStartDate = startOfDay(new Date(startDate));
    const normalizedEndDate = startOfDay(new Date(endDate));

    console.log('[useCalendar] Hook initialized:', {
        startDate: normalizedStartDate.toISOString(),
        endDate: normalizedEndDate.toISOString(),
        isAdminMode,
        dateRange: {
            diffMs: normalizedEndDate.getTime() - normalizedStartDate.getTime(),
            diffDays: Math.round((normalizedEndDate.getTime() - normalizedStartDate.getTime()) / (1000 * 60 * 60 * 24))
        }
    });

    // State
    const [config, setConfig] = useState<CalendarConfig | null>(null);
    const [customizations, setCustomizations] = useState<WeekCustomization[]>([]);
    const [selectedWeeks, setSelectedWeeks] = useState<Week[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    // Generate weeks with customizations
    const weeks = useMemo(() => {
        console.log('[useCalendar] Generating weeks:', {
            startDate: normalizedStartDate.toISOString(),
            endDate: normalizedEndDate.toISOString(),
            isAdminMode,
            customizationsCount: customizations.length,
            customizations: customizations.map(c => ({
                startDate: c.startDate.toISOString(),
                endDate: c.endDate.toISOString(),
                status: c.status,
                name: c.name
            }))
        });

        console.log('[useCalendar] Admin mode:', {
            isAdminMode
        });

        const generatedWeeks = generateWeeksWithCustomizations(
            normalizedStartDate, 
            normalizedEndDate, 
            config, 
            customizations,
            isAdminMode
        );

        console.log('[useCalendar] Generated weeks:', {
            count: generatedWeeks.length,
            firstWeek: generatedWeeks[0] ? {
                startDate: generatedWeeks[0].startDate.toISOString(),
                endDate: generatedWeeks[0].endDate.toISOString()
            } : null,
            lastWeek: generatedWeeks[generatedWeeks.length - 1] ? {
                startDate: generatedWeeks[generatedWeeks.length - 1].startDate.toISOString(),
                endDate: generatedWeeks[generatedWeeks.length - 1].endDate.toISOString()
            } : null
        });

        return generatedWeeks;
    }, [normalizedStartDate, normalizedEndDate, config, customizations, isAdminMode]);

    // Load initial data
    useEffect(() => {
        let mounted = true;

        async function loadData() {
            console.log('[useCalendar] Loading data...');
            try {
                setIsLoading(true);
                setError(null);

                // Load config and customizations in parallel
                const [configResult, customizationsResult] = await Promise.all([
                    CalendarService.getConfig(),
                    CalendarService.getCustomizations(normalizedStartDate, normalizedEndDate)
                ]);

                if (!mounted) return;

                console.log('[useCalendar] Data loaded:', {
                    config: configResult,
                    customizationsCount: customizationsResult.length
                });

                setConfig(configResult);
                setCustomizations(customizationsResult);
            } catch (err) {
                console.error('[useCalendar] Error loading data:', err);
                if (!mounted) return;
                setError(err instanceof Error ? err : new Error('Failed to load calendar data'));
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        loadData();
        return () => { mounted = false; };
    }, [normalizedStartDate.toISOString(), normalizedEndDate.toISOString(), lastRefresh]);

    // Week selection logic
    const selectWeek = useCallback((week: Week) => {
        if (selectedWeeks.length === 0) {
            setSelectedWeeks([week]);
        } else if (selectedWeeks.length === 1) {
            const [firstWeek] = selectedWeeks;
            const isAfter = week.startDate > firstWeek.startDate;
            setSelectedWeeks(isAfter ? [firstWeek, week] : [week, firstWeek]);
        } else {
            setSelectedWeeks([week]);
        }
    }, [selectedWeeks]);

    const clearSelection = useCallback(() => {
        setSelectedWeeks([]);
    }, []);

    // Admin actions with state updates
    const createCustomization = useCallback(async (customization: {
        startDate: Date;
        endDate: Date;
        status: string;
        name?: string | null;
    }) => {
        console.log('[useCalendar] Creating customization:', {
            startDate: customization.startDate.toISOString(),
            endDate: customization.endDate.toISOString(),
            status: customization.status,
            name: customization.name
        });

        const result = await CalendarService.createCustomization({
            startDate: customization.startDate,
            endDate: customization.endDate,
            status: customization.status,
            name: customization.name
        });
        
        if (result) {
            console.log('[useCalendar] Customization created successfully:', {
                id: result.id,
                startDate: result.startDate.toISOString(),
                status: result.status
            });
            
            setCustomizations(prev => [...prev, result]);
            setLastRefresh(Date.now());
        } else {
            console.error('[useCalendar] Failed to create customization - no result returned');
        }
        return result;
    }, []);

    const updateCustomization = useCallback(async (id: string, updates: Partial<Omit<WeekCustomization, 'id' | 'createdAt' | 'createdBy'>>) => {
        console.log('[useCalendar] Updating customization:', {
            id,
            startDate: updates.startDate?.toISOString(),
            endDate: updates.endDate?.toISOString(),
            status: updates.status,
            name: updates.name,
            isDateUpdate: !!updates.startDate || !!updates.endDate
        });

        try {
            const result = await CalendarService.updateCustomization(id, updates);
            
            if (result) {
                console.log('[useCalendar] Customization updated successfully:', {
                    id: result.id,
                    startDate: result.startDate.toISOString(),
                    status: result.status,
                    name: result.name
                });
                
                setCustomizations(prev => prev.map(c => c.id === id ? result : c));
                // Force refresh to regenerate weeks
                setLastRefresh(Date.now());
            } else {
                console.error('[useCalendar] Failed to update customization - no result returned');
                throw new Error('No result returned from update operation');
            }
            
            return result;
        } catch (err) {
            console.error('[useCalendar] Error in updateCustomization:', err);
            // Re-throw the error so the caller can handle it
            throw err;
        }
    }, []);

    const deleteCustomization = useCallback(async (id: string) => {
        console.log('[useCalendar] Deleting customization:', { id });
        const success = await CalendarService.deleteCustomization(id);
        if (success) {
            setCustomizations(prev => prev.filter(c => c.id !== id));
            // Force refresh to regenerate weeks
            setLastRefresh(Date.now());
        }
        return success;
    }, []);

    const updateConfig = useCallback(async (updates: Partial<Omit<CalendarConfig, 'id' | 'createdAt'>>) => {
        console.log('[useCalendar] Updating config:', updates);
        const result = await CalendarService.updateConfig(updates);
        if (result) {
            setConfig(result);
            // Force refresh to regenerate weeks
            setLastRefresh(Date.now());
        }
        return result;
    }, []);

    return {
        weeks,
        selectedWeeks,
        customizations,
        config,
        isLoading,
        error,
        setSelectedWeeks,
        selectWeek,
        clearSelection,
        createCustomization,
        updateCustomization,
        deleteCustomization,
        updateConfig,
        setLastRefresh
    };
}
