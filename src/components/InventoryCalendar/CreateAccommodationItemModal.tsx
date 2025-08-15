import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Accommodation {
  id: string;
  title: string;
  type: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated: (itemId: string) => void;
  defaultAccommodationType?: string;
}

export function CreateAccommodationItemModal({ isOpen, onClose, onItemCreated, defaultAccommodationType }: Props) {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    accommodation_id: '',
    type: 'BT',
    size: '4',
    zone: null as string | null,
    bedNumber: 1
  });

  // Fetch accommodations on mount and reset form
  useEffect(() => {
    if (isOpen) {
      // Reset form to defaults when modal opens
      setFormData({
        accommodation_id: '',
        type: 'BT',
        size: '4',
        zone: null,
        bedNumber: 1
      });
      setError(null);
      fetchAccommodations();
    }
  }, [isOpen]);

  const fetchAccommodations = async () => {
    try {
      const { data, error } = await supabase
        .from('accommodations')
        .select('id, title, type')
        .in('type', ['tent', 'parking', 'addon', 'dorm'])
        .order('title');

      if (error) throw error;
      setAccommodations(data || []);

      // If defaultAccommodationType is provided, try to find and select it
      if (defaultAccommodationType && data) {
        const defaultAccom = data.find(acc => acc.title === defaultAccommodationType);
        if (defaultAccom) {
          // Apply auto-detection for Van Parking (by ID or title)
          if (defaultAccom.id === '74d777b7-5268-4a8e-be22-b59eb8ba663d' || defaultAccom.title === 'Van Parking') {
            setFormData({
              accommodation_id: defaultAccom.id,
              type: 'VC',
              size: 'van',
              zone: null,
              bedNumber: 1
            });
          }
          // Apply auto-detection for Your Own Tent (by ID or title)
          else if (defaultAccom.id === '4c37de6b-3982-4734-b048-02a7cc585d89' || defaultAccom.title === 'Your Own Tent') {
            setFormData({
              accommodation_id: defaultAccom.id,
              type: 'TC',
              size: 'tent',
              zone: null,
              bedNumber: 1
            });
          }
          // Apply auto-detection for dorms
          else if (defaultAccom.type === 'dorm') {
            const zoneMatch = defaultAccom.title.match(/\(([A-Z])[0-9]*\)/);
            const zone = zoneMatch ? zoneMatch[1] : null;
            const type = defaultAccom.title.includes('3-Bed') ? 'D3' : 'D6';
            setFormData({
              accommodation_id: defaultAccom.id,
              type,
              zone,
              size: '1',
              bedNumber: 1
            });
          }
          else {
            setFormData(prev => ({ ...prev, accommodation_id: defaultAccom.id }));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching accommodations:', err);
      setError('Failed to load accommodations');
    }
  };

  const handleSubmit = async () => {
    if (!formData.accommodation_id) {
      setError('Please select an accommodation');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get the next available item_id for this type and size
      const { data: existingItems, error: fetchError } = await supabase
        .from('accommodation_items')
        .select('item_id')
        .eq('type', formData.type)
        .eq('size', formData.size)
        .order('item_id', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextItemId = existingItems && existingItems.length > 0 
        ? existingItems[0].item_id + 1 
        : 1;

      // Insert the new accommodation item
      const { data: newItem, error: insertError } = await supabase
        .from('accommodation_items')
        .insert({
          accommodation_id: formData.accommodation_id,
          zone: formData.zone,
          type: formData.type,
          size: formData.size,
          item_id: nextItemId
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      console.log('✅ New accommodation item created:', { 
        accommodation_id: formData.accommodation_id,
        type: formData.type,
        size: formData.size,
        item_id: nextItemId,
        zone: formData.zone
      });

      // Call the callback with the new item ID
      onItemCreated(newItem.id);
      onClose();

    } catch (err: any) {
      console.error('Create accommodation item error:', err);
      setError(err.message || 'Failed to create accommodation item');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center">
      <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            Create New Accommodation Tag
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-bg-surface-hover)] rounded"
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Accommodation
            </label>
            <select
              value={formData.accommodation_id}
              onChange={(e) => {
                const selectedAccomId = e.target.value;
                const selectedAccom = accommodations.find(acc => acc.id === selectedAccomId);
                
                // Auto-detect settings for Van Parking (by ID or title)
                if (selectedAccomId === '74d777b7-5268-4a8e-be22-b59eb8ba663d' || 
                    (selectedAccom && selectedAccom.title === 'Van Parking')) {
                  setFormData(prev => ({ 
                    ...prev, 
                    accommodation_id: selectedAccomId,
                    type: 'VC', // Van Camping
                    size: 'van',
                    zone: null // Let user choose zone
                  }));
                }
                // Auto-detect settings for Your Own Tent (by ID or title)
                else if (selectedAccomId === '4c37de6b-3982-4734-b048-02a7cc585d89' ||
                         (selectedAccom && selectedAccom.title === 'Your Own Tent')) {
                  setFormData(prev => ({ 
                    ...prev, 
                    accommodation_id: selectedAccomId,
                    type: 'TC', // Tent Camping
                    size: 'tent',
                    zone: null // Let user choose zone
                  }));
                }
                // Auto-detect settings for dorms
                else if (selectedAccom && selectedAccom.type === 'dorm') {
                  // Extract zone from title (e.g., "3-Bed Dorm (U3)" -> "U")
                  const zoneMatch = selectedAccom.title.match(/\(([A-Z])[0-9]*\)/);
                  const zone = zoneMatch ? zoneMatch[1] : null;
                  
                  // Determine type based on dorm size
                  const type = selectedAccom.title.includes('3-Bed') ? 'D3' : 'D6';
                  
                  setFormData(prev => ({ 
                    ...prev, 
                    accommodation_id: selectedAccomId,
                    type,
                    zone,
                    size: '1', // For dorms, size will be the bed number
                    bedNumber: 1
                  }));
                }
                else {
                  setFormData(prev => ({ ...prev, accommodation_id: selectedAccomId }));
                }
              }}
              disabled={loading}
              className="w-full p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded 
                       text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select accommodation...</option>
              {accommodations.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Zone
            </label>
            <select
              value={formData.zone || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, zone: e.target.value || null }))}
              disabled={loading}
              className="w-full p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded 
                       text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">None (Unknown)</option>
              <option value="T">T - Tipiland</option>
              <option value="G">G - Grove</option>
              <option value="C">C - Creek</option>
              <option value="M">M - Meadow</option>
              <option value="N">N - North</option>
              <option value="U">U - Upper</option>
              <option value="L">L - Lower</option>
              <option value="P">P - Parking</option>
            </select>
          </div>

          {accommodations.find(a => a.id === formData.accommodation_id)?.type !== 'dorm' && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                disabled={loading}
                className="w-full p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded 
                         text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="BT">BT - Bell Tent</option>
                <option value="PT">PT - Pumpkin-Shaped Bell Tent</option>
                <option value="TP">TP - Tipi</option>
                <option value="VC">VC - Van Camping</option>
                <option value="TC">TC - Tent Camping</option>
              </select>
            </div>
          )}

          {accommodations.find(a => a.id === formData.accommodation_id)?.type === 'dorm' ? (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Bed Number
              </label>
              <select
                value={formData.bedNumber}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  bedNumber: parseInt(e.target.value),
                  size: e.target.value
                }))}
                disabled={loading}
                className="w-full p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded 
                         text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {formData.type === 'D3' ? (
                  <>
                    <option value="1">Bed 1</option>
                    <option value="2">Bed 2</option>
                    <option value="3">Bed 3</option>
                  </>
                ) : (
                  <>
                    <option value="1">Bed 1</option>
                    <option value="2">Bed 2</option>
                    <option value="3">Bed 3</option>
                    <option value="4">Bed 4</option>
                    <option value="5">Bed 5</option>
                    <option value="6">Bed 6</option>
                  </>
                )}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Size
              </label>
              <select
                value={formData.size}
                onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value as any }))}
                disabled={loading}
                className="w-full p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded 
                         text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="2">2 - 2.2m Tipi (Single)</option>
                <option value="3">3 - 3m Tipi (Double)</option>
                <option value="4">4 - 4m Bell tent</option>
                <option value="5">5 - 5m Bell tent</option>
                <option value="6">6 - 6m Bell tent (Group)</option>
                <option value="tent">Tent - Your Own Tent</option>
                <option value="van">Van - Van Parking</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={loading || !formData.accommodation_id}
            className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 
                     disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors
                     flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Create Tag
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)] 
                     rounded hover:bg-[var(--color-bg-surface-hover-2)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}