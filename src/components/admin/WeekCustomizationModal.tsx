import React, { useState, useEffect, useCallback } from 'react';
import { format, getDay } from 'date-fns';
import { Week, WeekStatus } from '../../types/calendar';
import { formatDateForDisplay } from '../../utils/dates';
import { AlertTriangle, Info } from 'lucide-react';
import { CalendarService } from '../../services/CalendarService';

interface Props {
    week: Week;
    isOpen?: boolean;
    onClose: () => void;
    onSave: (updates: {
        status: WeekStatus;
        name?: string;
        startDate?: Date;
        endDate?: Date;
    }) => Promise<void>;
}

export function WeekCustomizationModal({ week, isOpen = true, onClose, onSave }: Props) {
    console.log('[WeekCustomizationModal] Opening modal for week:', {
        isOpen,
        weekDetails: week ? {
            startDate: formatDateForDisplay(week.startDate),
            endDate: formatDateForDisplay(week.endDate),
            status: week.status,
            name: week.name,
            isCustom: week.isCustom
        } : null
    });

    const [status, setStatus] = useState<WeekStatus>(week?.status === 'default' ? 'visible' : week?.status || 'default');
    const [name, setName] = useState(week?.name || '');
    const [startDate, setStartDate] = useState(format(week.startDate, 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(week.endDate, 'yyyy-MM-dd'));
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [calendarConfig, setCalendarConfig] = useState<{ checkInDay: number; checkOutDay: number } | null>(null);
    const [dateWarning, setDateWarning] = useState<string | null>(null);

    // Fetch calendar config on mount
    useEffect(() => {
        async function fetchCalendarConfig() {
            try {
                const config = await CalendarService.getConfig();
                if (config) {
                    setCalendarConfig({
                        checkInDay: config.checkInDay,
                        checkOutDay: config.checkOutDay
                    });
                    console.log('[WeekCustomizationModal] Loaded calendar config:', {
                        checkInDay: config.checkInDay,
                        checkOutDay: config.checkOutDay
                    });
                }
            } catch (err) {
                console.error('[WeekCustomizationModal] Error fetching calendar config:', err);
            }
        }
        fetchCalendarConfig();
    }, []);

    useEffect(() => {
        if (week) {
            console.log('[WeekCustomizationModal] Loading week details:', {
                weekStartDate: formatDateForDisplay(week.startDate),
                weekEndDate: formatDateForDisplay(week.endDate),
                weekStatus: week.status,
                name: week.name
            });
            setStatus(week.status === 'default' ? 'visible' : week.status || 'default');
            setName(week.name || '');
        }
    }, [week]);

    // Validate dates when they change
    useEffect(() => {
        if (calendarConfig) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            const startDay = getDay(start);
            const endDay = getDay(end);
            
            let warning = null;
            
            if (startDay !== calendarConfig.checkInDay) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                warning = `Start date should be a ${dayNames[calendarConfig.checkInDay]} (check-in day)`;
            } else if (endDay !== calendarConfig.checkOutDay) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                warning = `End date should be a ${dayNames[calendarConfig.checkOutDay]} (check-out day)`;
            }
            
            setDateWarning(warning);
        }
    }, [startDate, endDate, calendarConfig]);

    const handleSave = useCallback(async () => {
        try {
            console.log('[WeekCustomizationModal] Saving customization:', {
                weekStartDate: formatDateForDisplay(week?.startDate),
                weekEndDate: formatDateForDisplay(week?.endDate),
                status,
                name
            });

            if (!week) {
                throw new Error('No week selected');
            }

            // Validate dates
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (start > end) {
                setError('Start date cannot be after end date');
                return;
            }

            setIsSaving(true);
            await onSave({
                status,
                name: name.trim() || undefined,
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            });
            onClose();
        } catch (err) {
            console.error('[WeekCustomizationModal] Error saving customization:', err);
            setError(err instanceof Error ? err.message : 'Failed to save customization');
        } finally {
            setIsSaving(false);
        }
    }, [week, status, name, startDate, endDate, onSave, onClose]);

    const getStatusHint = () => {
        if (week?.status === 'deleted') {
            return (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-md">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        <span className="font-medium">This week is already deleted</span>
                    </div>
                    <p className="mt-1 text-sm">
                        Setting this week to "deleted" again will have no effect.
                    </p>
                </div>
            );
        } else if (week?.status === 'hidden') {
            return (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md">
                    <div className="flex items-center">
                        <Info className="h-5 w-5 mr-2" />
                        <span className="font-medium">This week is currently hidden</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Customize Week</h2>
                
                {/* Status Hint */}
                {getStatusHint()}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-md">
                        <div className="flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Status Selection */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                    </label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as WeekStatus)}
                        className="w-full p-2 border rounded"
                    >
                        <option value="visible">Available</option>
                        <option value="hidden">Hidden</option>
                        <option value="deleted">Deleted</option>
                    </select>
                </div>

                {/* Week Name */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Week Name (Optional)
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Christmas Week"
                        className="w-full p-2 border rounded"
                    />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={`w-full p-2 border rounded ${dateWarning && dateWarning.includes('Start date') ? 'border-yellow-400' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={`w-full p-2 border rounded ${dateWarning && dateWarning.includes('End date') ? 'border-yellow-400' : ''}`}
                        />
                    </div>
                </div>

                {/* Date Warning */}
                {dateWarning && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md text-sm">
                        <div className="flex items-center">
                            <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{dateWarning}</span>
                        </div>
                        <p className="mt-1 ml-6">
                            Changing this date may affect how weeks are displayed in the calendar.
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
