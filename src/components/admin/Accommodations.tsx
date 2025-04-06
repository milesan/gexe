import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

interface Accommodation {
  id: string;
  title: string;
  base_price: number;
  type: string;
  capacity: number;
  has_wifi: boolean;
  has_electricity: boolean;
  image_url: string;
  is_unlimited: boolean;
  bed_size: string;
  bathroom_type: string;
  bathrooms: number;
}

export function Accommodations() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccommodations();
  }, []);

  const fetchAccommodations = async () => {
    try {
      const { data, error } = await supabase
        .from('accommodations')
        .select('*')
        .order('title');

      if (error) throw error;
      setAccommodations(data || []);
    } catch (error) {
      console.error('Error fetching accommodations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, accommodationId: string) => {
    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload only image files');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError('File size must be less than 5MB');
      return;
    }

    setUploadError(null);
    setUploadProgress(0);

    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
      console.log('📤 Uploading to storage:', { fileName });
      
      const { data, error } = await supabase.storage
        .from('accommodations')
        .upload(`photos/${fileName}`, file, {
          upsert: false,
          contentType: file.type
        });

      if (error) throw error;
      console.log('✅ Upload successful:', { fileName });

      const { data: { publicUrl } } = supabase.storage
        .from('accommodations')
        .getPublicUrl(`photos/${fileName}`);

      console.log('🔗 Generated public URL:', { publicUrl });

      // Update accommodation record with new image URL
      const { error: updateError } = await supabase
        .from('accommodations')
        .update({ image_url: publicUrl })
        .eq('id', accommodationId);

      if (updateError) throw updateError;

      setUploadProgress(100);
      await fetchAccommodations();
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload image');
      setUploadProgress(0);
    }
  };

  if (loading) {
    return <div className="p-4 text-[var(--color-text-secondary)]">Loading...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-display mb-4 text-[var(--color-text-primary)]">Accommodations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accommodations.map((accommodation) => (
          <div key={accommodation.id} className="bg-[var(--color-bg-surface)] rounded-lg shadow-sm border border-[var(--color-border)] p-4">
            <div className="relative aspect-video mb-4 group">
              {accommodation.image_url ? (
                <img
                  src={accommodation.image_url}
                  alt={accommodation.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-full bg-[var(--color-bg-surface-hover)] rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-[var(--color-text-secondary)]" />
                </div>
              )}
              <label className="absolute bottom-2 right-2 bg-[var(--color-bg-surface-transparent)] backdrop-blur-sm p-2 rounded-full shadow-sm cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file, accommodation.id);
                    }
                  }}
                />
                <Upload className={`w-4 h-4 ${uploadProgress > 0 && uploadProgress < 100 ? 'animate-spin text-white' : 'text-yellow-300'}`} />
              </label>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
                  <div className="text-white">
                    <Upload className="w-6 h-6 animate-bounce" />
                    <span className="ml-2">{Math.round(uploadProgress)}%</span>
                  </div>
                </div>
              )}
            </div>
            <h3 className="font-semi-bold font-regular mb-2 text-[var(--color-text-primary)]">{accommodation.title}</h3>
            <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              <p>Type: {accommodation.type}</p>
              <p>Price: €{accommodation.base_price}</p>
              <p>Capacity: {accommodation.capacity || 'N/A'}</p>
              <p>Bed Size: {accommodation.bed_size}</p>
              <p>Bathroom: {accommodation.bathroom_type} ({accommodation.bathrooms})</p>
              <div className="flex gap-2">
                {accommodation.has_wifi && <span className="bg-[var(--color-bg-success-subtle)] text-[var(--color-text-success)] px-2 py-1 rounded">WiFi</span>}
                {accommodation.has_electricity && <span className="bg-[var(--color-bg-success-subtle)] text-[var(--color-text-success)] px-2 py-1 rounded">Electricity</span>}
              </div>
            </div>
            {uploadError && (
              <div className="mt-2 flex items-center text-[var(--color-text-error)] text-sm">
                <X className="w-4 h-4 mr-2" />
                {uploadError}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 