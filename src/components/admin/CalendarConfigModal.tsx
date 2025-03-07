import React, { useState, useEffect, useCallback } from 'react';
import { Info, Save, X } from 'lucide-react';
import { CalendarService } from '../../services/CalendarService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function CalendarConfigModal({ isOpen, onClose, onSaved }: Props) {
  const [checkInDay, setCheckInDay] = useState<number>(0);
  const [checkOutDay, setCheckOutDay] = useState<number>(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  // Load current config when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          setLoading(true);
          setError(null);
          const config = await CalendarService.getConfig();
          
          if (config) {
            setCheckInDay(config.checkInDay);
            setCheckOutDay(config.checkOutDay);
            console.log('[CalendarConfigModal] Loaded current config:', { 
              checkInDay: config.checkInDay, 
              checkOutDay: config.checkOutDay 
            });
          }
        } catch (err) {
          console.error('[CalendarConfigModal] Error loading config:', err);
          setError('Failed to load calendar configuration');
        } finally {
          setLoading(false);
        }
      };
      
      fetchConfig();
    }
  }, [isOpen]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      console.log('[CalendarConfigModal] Saving config:', { checkInDay, checkOutDay });
      
      await CalendarService.updateConfig({
        checkInDay,
        checkOutDay
      });
      
      setSuccessMessage('Calendar configuration saved successfully');
      console.log('[CalendarConfigModal] Config saved successfully');
      
      // Notify parent component
      if (onSaved) {
        onSaved();
      }
      
      // Auto-close after success (optional)
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err) {
      console.error('[CalendarConfigModal] Error saving config:', err);
      setError('Failed to save calendar configuration');
    } finally {
      setSaving(false);
    }
  }, [checkInDay, checkOutDay, onClose, onSaved]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Calendar Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading settings...</div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-md">
                {error}
              </div>
            )}
            
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 rounded-md">
                {successMessage}
              </div>
            )}
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Set the default check-in and check-out days for your property. These settings affect how weeks are displayed and booked throughout the calendar.
              </p>
              
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Check-in Day
                  </label>
                  <select
                    value={checkInDay}
                    onChange={(e) => setCheckInDay(Number(e.target.value))}
                    className="w-full p-2 border rounded bg-white"
                    disabled={saving}
                  >
                    {dayOptions.map((day) => (
                      <option key={`in-${day.value}`} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Check-out Day
                  </label>
                  <select
                    value={checkOutDay}
                    onChange={(e) => setCheckOutDay(Number(e.target.value))}
                    className="w-full p-2 border rounded bg-white"
                    disabled={saving}
                  >
                    {dayOptions.map((day) => (
                      <option key={`out-${day.value}`} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {checkInDay === checkOutDay && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md text-sm">
                  <div className="flex items-start">
                    <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Check-in and check-out on the same day may cause scheduling conflicts. Consider setting different days.</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {saving ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 