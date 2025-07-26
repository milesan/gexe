import { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarConfig, Week, WeekCustomization } from '../types/calendar';
import { CalendarService } from '../services/CalendarService';
import { generateWeeksWithCustomizations, startOfDay, normalizeToUTCDate } from '../utils/dates';

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
    // Normalize dates immediately when they enter the hook
    const normalizedStartDate = normalizeToUTCDate(startDate);
    const normalizedEndDate = normalizeToUTCDate(endDate);

    console.log('[useCalendar] Hook initialized:', {
        startDate: startOfDay(new Date(startDate)),
        endDate: startOfDay(new Date(endDate)),
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
    const [lastRefresh, setLastRefresh] = useState(0);

    // Generate weeks with customizations
    const weeks = useMemo(() => {
        console.log('[useCalendar] Generating weeks within useMemo:', {
            normalizedStartDate: normalizedStartDate.toISOString(),
            normalizedEndDate: normalizedEndDate.toISOString(),
            isAdminMode,
            customizationsCount: customizations.length,
        });

        console.log('[useCalendar] Customizations BEFORE generation:', customizations.map(c => ({
            id: c.id,
            startDate: c.startDate instanceof Date ? c.startDate.toISOString() : c.startDate,
            endDate: c.endDate instanceof Date ? c.endDate.toISOString() : c.endDate,
            status: c.status,
            name: c.name,
            flexibleDates: c.flexibleDates?.map(d => d instanceof Date ? d.toISOString() : d)
        })));

        const generatedWeeks = generateWeeksWithCustomizations(
            normalizedStartDate,
            normalizedEndDate,
            config,
            customizations,
            isAdminMode
        );

        console.log('[useCalendar] Generated weeks AFTER generation:', {
            count: generatedWeeks.length,
            weeks: generatedWeeks.map(w => ({
                id: w.id,
                startDate: w.startDate instanceof Date ? w.startDate.toISOString() : w.startDate,
                endDate: w.endDate instanceof Date ? w.endDate.toISOString() : w.endDate,
                status: w.status,
                name: w.name,
                isCustom: w.isCustom,
                flexibleDates: w.flexibleDates?.map(d => d instanceof Date ? d.toISOString() : d)
            }))
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
    }, [normalizedStartDate.getTime(), normalizedEndDate.getTime(), lastRefresh]);

    // Week selection logic
    const selectWeek = useCallback((week: Week) => {
        const normalizedWeek = {
            ...week,
            startDate: normalizeToUTCDate(week.startDate),
            endDate: normalizeToUTCDate(week.endDate)
        };

        if (selectedWeeks.length === 0) {
            setSelectedWeeks([normalizedWeek]);
        } else if (selectedWeeks.length === 1) {
            const [firstWeek] = selectedWeeks;
            const isAfter = normalizedWeek.startDate > firstWeek.startDate;
            setSelectedWeeks(isAfter ? [firstWeek, normalizedWeek] : [normalizedWeek, firstWeek]);
        } else {
            setSelectedWeeks([normalizedWeek]);
        }
    }, [selectedWeeks]);

    const clearSelection = useCallback(() => {
        setSelectedWeeks([]);
    }, []);

    // Admin actions with state updates
    const createCustomization = useCallback(async (customization: Omit<WeekCustomization, 'id' | 'createdAt' | 'createdBy'>) => {
        console.log('[useCalendar] Creating customization:', {
            startDate: customization.startDate.toISOString(),
            endDate: customization.endDate.toISOString(),
            status: customization.status,
            name: customization.name,
            flexibleDatesCount: customization.flexibleDates?.length
        });

        const result = await CalendarService.createCustomization({
            startDate: customization.startDate,
            endDate: customization.endDate,
            status: customization.status,
            name: customization.name || undefined,
            flexibleDates: customization.flexibleDates
        });
        
        if (result) {
            console.log('[useCalendar] Customization created successfully:', {
                id: result.id,
                startDate: result.startDate.toISOString(),
                status: result.status,
                flexibleDatesCount: result.flexibleDates?.length
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
        if (typeof updates.checkInDay !== 'number' || typeof updates.checkOutDay !== 'number') {
            throw new Error('Check-in and check-out days must be numbers');
        }
        const result = await CalendarService.updateConfig({
            checkInDay: updates.checkInDay,
            checkOutDay: updates.checkOutDay
        });
        if (result) {
            setConfig(result);
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
