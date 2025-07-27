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

  // Base modal classes (consistent with DiscountModal)
  const modalOverlayClasses = "fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4"; // Match DiscountModal
  const contentContainerClasses = "bg-gray-800/95 rounded-sm p-4 sm:p-6 max-w-md w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 text-white backdrop-blur-sm"; // Match DiscountModal styling
  const contentPaddingClasses = ""; // Padding is now part of contentContainerClasses
  const textBaseClasses = "text-white font-mono"; // Simplified for dark modal
  const textMutedClasses = "text-gray-300 font-mono"; // Simplified for dark modal
  const inputBaseClasses = "w-full p-2 border rounded bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-white placeholder-gray-400 disabled:opacity-50 dark:disabled:opacity-60 font-mono"; // Simplified dark styles
  const buttonBaseClasses = "px-4 py-2 rounded disabled:opacity-50 font-mono focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonClasses = `${buttonBaseClasses} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-blue-400 flex items-center`; // Simplified dark styles
  const secondaryButtonClasses = `${buttonBaseClasses} text-gray-300 hover:text-white border border-gray-600 bg-gray-700 hover:bg-gray-600 focus:ring-gray-400`; // Simplified dark styles
  const closeButtonClasses = "absolute top-2 sm:top-4 right-2 sm:right-4 text-gray-300 hover:text-white"; // Match DiscountModal

  // Alert styles (assuming dark mode base)
  const errorAlertClasses = "p-3 border rounded-md bg-red-900/30 border-red-500/50 text-red-300";
  const successAlertClasses = "p-3 border rounded-md bg-green-900/30 border-green-500/50 text-green-300";
  const warningAlertClasses = "p-3 border rounded-md bg-yellow-900/30 border-yellow-500/50 text-yellow-300 text-sm";
  const infoSectionClasses = "border rounded-md p-4 bg-gray-700/40 border-gray-600";

  return (
    <div className={modalOverlayClasses} onClick={onClose}>
      <div 
        className={`${contentContainerClasses} ${textBaseClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-bold ${textBaseClasses.replace('font-mono', '')}`}>Calendar Settings</h2>
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
                    <span className="font-mono">Check-in and check-out on the same day may cause scheduling conflicts. Consider setting different days.</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
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
                    <span className="font-mono">Save Settings</span>
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
