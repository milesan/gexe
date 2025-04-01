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
            console.log('[CalendarConfigModal] Loaded config:', config);
            setCheckInDay(config.checkInDay || 0);
            setCheckOutDay(config.checkOutDay || 6);
          } else {
            console.log('[CalendarConfigModal] No config found, using defaults');
            setCheckInDay(0); // Default to Sunday
            setCheckOutDay(6); // Default to Saturday
          }
        } catch (err) {
          console.error('[CalendarConfigModal] Error loading config:', err);
          setError('Failed to load calendar configuration. Using defaults.');
          
          // Set defaults even on error
          setCheckInDay(0);
          setCheckOutDay(6);
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
      
      await CalendarService.updateConfig({
        checkInDay,
        checkOutDay
      });
      
      setSuccessMessage('Calendar configuration saved successfully');
      
      // Notify parent component
      if (onSaved) {
        onSaved();
      }
      
      // Close modal after a delay
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

  // Base modal classes (consistent with other modals)
  const modalOverlayClasses = "fixed inset-0 bg-black bg-opacity-30 dark:bg-overlay dark:backdrop-blur-sm flex items-center justify-center z-50 p-4";
  const contentContainerClasses = "rounded-lg max-w-md w-full shadow-xl border border-gray-300 dark:border-gray-500/30 relative bg-white dark:bg-gray-800/95 dark:backdrop-blur-sm max-h-[85vh] overflow-y-auto";
  const contentPaddingClasses = "p-6";
  const textBaseClasses = "text-gray-900 dark:text-white font-regular";
  const textMutedClasses = "text-gray-600 dark:text-gray-300 font-regular";
  const inputBaseClasses = "w-full p-2 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 dark:text-white dark:placeholder-gray-400 disabled:opacity-50 dark:disabled:opacity-60 font-regular";
  const buttonBaseClasses = "px-4 py-2 rounded disabled:opacity-50 font-regular focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonClasses = `${buttonBaseClasses} bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 flex items-center`;
  const secondaryButtonClasses = `${buttonBaseClasses} text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-gray-400`;
  const closeButtonClasses = "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white";

  // Alert styles
  const errorAlertClasses = "p-3 border rounded-md bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300";
  const successAlertClasses = "p-3 border rounded-md bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-500/50 text-green-700 dark:text-green-300";
  const warningAlertClasses = "p-3 border rounded-md bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-600/50 text-yellow-700 dark:text-yellow-300 text-sm";
  const infoSectionClasses = "border rounded-md p-4 bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600";

  return (
    <div className={modalOverlayClasses}>
      <div className={`${contentContainerClasses} ${textBaseClasses}`}>
        {/* Outer container now handles scrolling */}
        {/* Apply padding inside */}
        <div className={contentPaddingClasses}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-bold ${textBaseClasses.replace('font-regular', '')}`}>Calendar Settings</h2>
            <button onClick={onClose} className={closeButtonClasses} disabled={saving}>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {loading ? (
            <div className={`py-8 text-center ${textMutedClasses}`}>Loading settings...</div>
          ) : (
            <>
              {error && (
                <div className={`mb-4 ${errorAlertClasses}`}>
                  {error}
                </div>
              )}
              
              {successMessage && (
                <div className={`mb-4 ${successAlertClasses}`}>
                  {successMessage}
                </div>
              )}
              
              <div className="mb-6">
                <p className={`text-sm mb-4 ${textMutedClasses}`}>
                  Set the default check-in and check-out days for your property. These settings affect how weeks are displayed and booked throughout the calendar.
                </p>
                
                <div className={infoSectionClasses}>
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-1 ${textMutedClasses}`}>
                      Default Check-in Day
                    </label>
                    <select
                      value={checkInDay}
                      onChange={(e) => setCheckInDay(Number(e.target.value))}
                      className={inputBaseClasses}
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
                    <label className={`block text-sm font-medium mb-1 ${textMutedClasses}`}>
                      Default Check-out Day
                    </label>
                    <select
                      value={checkOutDay}
                      onChange={(e) => setCheckOutDay(Number(e.target.value))}
                      className={inputBaseClasses}
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
                  <div className={`mt-3 ${warningAlertClasses}`}>
                    <div className="flex items-start">
                      <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="font-regular">Check-in and check-out on the same day may cause scheduling conflicts. Consider setting different days.</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Added border top for separation */}
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  className={secondaryButtonClasses}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={primaryButtonClasses}
                >
                  {saving ? 'Saving...' : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      <span className="font-regular">Save Settings</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 