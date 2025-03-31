import React, { useState } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

interface BlackoutModalProps {
  startDate: Date;
  endDate: Date;
  accommodations: any[];
  onClose: () => void;
  onSave: () => void;
}

export function BlackoutModal({ startDate, endDate, accommodations, onClose, onSave }: BlackoutModalProps) {
  const [selectedAccommodation, setSelectedAccommodation] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedAccommodation) {
      setError('Please select an accommodation');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('blackout_dates')
        .insert({
          accommodation_id: selectedAccommodation,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          reason: reason || 'Maintenance'
        });

      if (insertError) throw insertError;

      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save blackout dates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-primary">Add Blackout Dates</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Dates
            </label>
            <p className="text-secondary">
              {format(startDate, 'PP')} - {format(endDate, 'PP')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Accommodation
            </label>
            <select
              value={selectedAccommodation}
              onChange={(e) => setSelectedAccommodation(e.target.value)}
              className="w-full p-2 border border-color rounded-lg bg-main text-primary"
            >
              <option value="">Select accommodation</option>
              {accommodations.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Maintenance, Private event"
              className="w-full p-2 border border-color rounded-lg bg-main text-primary"
            />
          </div>

          {error && (
            <div className="text-error text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-secondary hover:text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-error text-white px-4 py-2 rounded-lg hover:bg-error-hover disabled:bg-border disabled:text-secondary disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}