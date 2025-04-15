import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Image as ImageIcon, X, Check, Save, Pencil, Wifi, Zap } from 'lucide-react';

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
  // bathroom_type: string; // REMOVE
  // bathrooms: number; // REMOVE
}

// Helper type for subset of fields allowed for editing
type EditableAccommodationFields = Omit<Accommodation, 'id' | 'image_url' | 'is_unlimited'>;

// Define allowed accommodation types (Ideally fetch this from DB enum `accommodation_type`)
const ALLOWED_ACCOMMODATION_TYPES = [
    'room',
    'dorm',
    'cabin',
    'tent',
    'parking',
    'addon',
    'test'
];

export function Accommodations() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingAccommodationId, setEditingAccommodationId] = useState<string | null>(null);
  // State to hold the *copy* of the data being edited
  const [currentEditData, setCurrentEditData] = useState<Accommodation | null>(null);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  // Called when the main "Edit" button for a card is clicked
  const handleEditClick = (accommodation: Accommodation) => {
    console.log('[ACCOM] Edit Mode Activated:', { id: accommodation.id });
    setEditingAccommodationId(accommodation.id);
    // IMPORTANT: Create a shallow copy to avoid mutating the original state directly
    setCurrentEditData({ ...accommodation });
    setEditError(null); // Clear previous errors
    setEditLoading(false); // Ensure loading is reset
  };

  // Generic handler for input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    fieldName: keyof EditableAccommodationFields
  ) => {
    if (!currentEditData) return;

    const { value, type } = e.target;
    let processedValue: string | number | boolean = value;

    // Handle checkbox type
    if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
      processedValue = e.target.checked;
    }
    // Handle number type - Ensure we store numbers, not strings
    else if (type === 'number') {
       // Allow empty string temporarily, validation happens on save
      processedValue = value === '' ? '' : parseFloat(value);
       if (isNaN(processedValue as number) && value !== '') {
         console.warn('[ACCOM] Invalid number input blocked for field:', fieldName, 'value:', value);
         // Optionally set an immediate error or just let validation catch it on save
         // For now, we just don't update state if it's not a valid number format or empty
         return;
       }
    }

    console.log('[ACCOM] Input Change:', { fieldName, processedValue });
    setCurrentEditData({
      ...currentEditData,
      [fieldName]: processedValue,
    });
  };

  // Called when "Cancel" is clicked in edit mode
  const handleCancelEdit = () => {
    console.log('[ACCOM] Edit Cancelled:', { id: editingAccommodationId });
    setEditingAccommodationId(null);
    setCurrentEditData(null); // Clear the temporary edit data
    setEditError(null);
    setEditLoading(false);
  };

  // Called when "Save" is clicked in edit mode
  const handleSaveChanges = async () => {
    if (!currentEditData || !editingAccommodationId) {
        console.error('[ACCOM] Save Error: No data to save or ID missing.');
        setEditError("Cannot save, editing state is invalid.");
        return;
    }

    setEditLoading(true);
    setEditError(null);
    console.log('[ACCOM] Attempting Save:', { id: editingAccommodationId, data: currentEditData });

    // --- Validation ---
    const errors: string[] = [];
    const dataToSave: Partial<EditableAccommodationFields> = {}; // Build the object to send

    // Find the original accommodation to compare against (optional, for sending only changes)
    const originalAccommodation = accommodations.find(acc => acc.id === editingAccommodationId);

    // Validate and prepare each field
    // Title (example: required, string)
    const title = currentEditData.title.trim();
    if (!title) {
        errors.push("Title cannot be empty.");
    } else if (!originalAccommodation || title !== originalAccommodation.title) {
        dataToSave.title = title;
    }

    // Base Price (example: required, non-negative integer)
    const base_price_str = String(currentEditData.base_price).trim();
    const base_price_num = parseInt(base_price_str, 10);
    if (base_price_str === '' || isNaN(base_price_num) || base_price_num < 0 || !Number.isInteger(base_price_num) || String(base_price_num) !== base_price_str) {
        errors.push("Price must be a non-negative whole number.");
    } else if (!originalAccommodation || base_price_num !== originalAccommodation.base_price) {
        dataToSave.base_price = base_price_num;
    }

    // Type (example: required, string from enum)
    const type = currentEditData.type.trim();
     if (!type) {
         errors.push("Type cannot be empty.");
     } else if (!ALLOWED_ACCOMMODATION_TYPES.includes(type)) {
         // This validation technically shouldn't fail if using the dropdown,
         // but good to have as a safeguard.
         errors.push(`Invalid type selected: ${type}. Allowed types: ${ALLOWED_ACCOMMODATION_TYPES.join(', ')}`);
     } else if (!originalAccommodation || type !== originalAccommodation.type) {
         dataToSave.type = type;
     }

    // Capacity (example: required, positive integer)
     const capacity_str = String(currentEditData.capacity).trim();
     const capacity_num = parseInt(capacity_str, 10);
     if (capacity_str === '' || isNaN(capacity_num) || capacity_num <= 0 || !Number.isInteger(capacity_num) || String(capacity_num) !== capacity_str) {
         errors.push("Capacity must be a positive whole number.");
     } else if (!originalAccommodation || capacity_num !== originalAccommodation.capacity) {
         dataToSave.capacity = capacity_num;
     }

     // Bed Size (example: optional, string) - Assuming optional for now
     const bed_size_val = currentEditData.bed_size ?? ''; // Handle potential null
     const bed_size = bed_size_val.trim();
     if (!originalAccommodation || bed_size !== (originalAccommodation.bed_size ?? '')) { // Compare safely
         dataToSave.bed_size = bed_size; // Save even if empty string, if it changed from null or another value
     }

    // has_wifi (boolean)
    if (!originalAccommodation || currentEditData.has_wifi !== originalAccommodation.has_wifi) {
        dataToSave.has_wifi = currentEditData.has_wifi;
    }

    // has_electricity (boolean)
    if (!originalAccommodation || currentEditData.has_electricity !== originalAccommodation.has_electricity) {
        dataToSave.has_electricity = currentEditData.has_electricity;
    }

    if (errors.length > 0) {
      const errorMessage = errors.join(' ');
      console.error('[ACCOM] Save Validation Error:', { id: editingAccommodationId, errors });
      setEditError(errorMessage);
      setEditLoading(false);
      return;
    }

    // Check if anything actually changed
     if (Object.keys(dataToSave).length === 0) {
         console.log('[ACCOM] Save skipped: No changes detected.', { id: editingAccommodationId });
         handleCancelEdit(); // Exit edit mode as if saved successfully
         return;
     }

    // --- Perform Update ---
    try {
      console.log('[ACCOM] Updating Supabase:', { id: editingAccommodationId, changes: dataToSave });
      const { error: updateError } = await supabase
        .from('accommodations')
        .update(dataToSave) // Send only the changed data
        .eq('id', editingAccommodationId);

      if (updateError) throw updateError;

      console.log('[ACCOM] Save Successful:', { id: editingAccommodationId });

      // Update local state immediately for responsiveness
      setAccommodations(prev =>
        prev.map(acc =>
          acc.id === editingAccommodationId ? { ...acc, ...currentEditData } : acc // Use currentEditData which has ALL fields updated
        )
      );

      handleCancelEdit(); // Exit edit mode

    } catch (err: any) {
      console.error('[ACCOM] Supabase Save Error:', err);
      setEditError(err.message || "Failed to save changes.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleImageUpload = async (file: File, accommodationId: string) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload only image files');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setUploadError(null);
    setUploadProgress(0);

    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
      console.log('📤 Uploading to storage:', { fileName, accommodationId });
      
      const { data, error } = await supabase.storage
        .from('accommodations')
        .upload(`photos/${fileName}`, file, {
          upsert: false,
          contentType: file.type
        });

      if (error) throw error;
      console.log('✅ Upload successful:', { fileName, accommodationId });

      const { data: { publicUrl } } = supabase.storage
        .from('accommodations')
        .getPublicUrl(`photos/${fileName}`);

      console.log('🔗 Generated public URL:', { publicUrl, accommodationId });

      const { error: updateError } = await supabase
        .from('accommodations')
        .update({ image_url: publicUrl })
        .eq('id', accommodationId);

      if (updateError) throw updateError;
      console.log('✅ Image URL updated in DB:', { publicUrl, accommodationId });

      // Update local state immediately
      setAccommodations(prev =>
        prev.map(acc =>
          acc.id === accommodationId ? { ...acc, image_url: publicUrl } : acc
        )
      );
      // If currently editing this accommodation, update edit state too
      if (editingAccommodationId === accommodationId && currentEditData) {
          setCurrentEditData({...currentEditData, image_url: publicUrl});
      }
      setUploadProgress(100); // Maybe reset after a short delay?
       // Optional: Refetch? Or rely on local state update.
      // await fetchAccommodations(); 
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload image');
      setUploadProgress(0);
    } finally {
      // Reset progress potentially here or after a timeout
      // setUploadProgress(0);
    }
  };

  if (loading) {
    return <div className="p-4 text-[var(--color-text-secondary)]">Loading...</div>;
  }

  // Common input styles
  const inputClassName = "w-full px-2 py-1 border border-[var(--color-border)] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-regular text-sm disabled:opacity-50";
  const numberInputClassName = inputClassName + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const labelClassName = "text-xs font-medium text-[var(--color-text-secondary)] mb-0.5 block"; // Added label style
  const checkboxLabelClassName = "flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer";
  const checkboxInputClassName = "form-checkbox h-4 w-4 text-[var(--color-accent-primary)] bg-[var(--color-input-bg)] border-[var(--color-border)] rounded focus:ring-[var(--color-accent-primary)] focus:ring-offset-0 focus:ring-1 disabled:opacity-50";

  return (
    <div className="p-4">
      <h2 className="text-xl font-display mb-4 text-[var(--color-text-primary)]">Accommodations</h2>
      {/* Global Upload Error Display */} 
      {uploadError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
              Image Upload Error: {uploadError}
          </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accommodations.map((accommodation) => {
          const isEditingThis = editingAccommodationId === accommodation.id;
          return (
            <div key={accommodation.id} className={`bg-[var(--color-bg-surface)] rounded-lg shadow-sm border ${isEditingThis ? 'border-[var(--color-accent-primary)] ring-1 ring-[var(--color-accent-primary)]' : 'border-[var(--color-border)]'} p-4 flex flex-col`}>
              {/* Image Section */} 
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
                <label className={`absolute bottom-2 right-2 bg-[var(--color-bg-surface-transparent)] backdrop-blur-sm p-2 rounded-full shadow-sm cursor-pointer transition-colors ${isEditingThis ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isEditingThis} // Disable upload while editing other fields
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(file, accommodation.id);
                      }
                    }}
                  />
                  <Upload className={`w-4 h-4 text-yellow-300 ${uploadProgress > 0 && uploadProgress < 100 ? 'animate-spin text-white' : ''}`} />
                </label>
                {/* Maybe show progress indicator specific to this card? */} 
              </div>

              {/* Header: Title and Edit/Save/Cancel Controls */} 
              <div className="flex justify-between items-start mb-3">
                {isEditingThis && currentEditData ? (
                    <div className='flex-grow mr-2'>
                        <label htmlFor={`title-${accommodation.id}`} className={labelClassName}>Title</label>
                        <input
                            type="text"
                            id={`title-${accommodation.id}`}
                            value={currentEditData.title}
                            onChange={(e) => handleInputChange(e, 'title')}
                            disabled={editLoading}
                            className={inputClassName}
                        />
                    </div>
                ) : (
                  <h3 className="font-semi-bold font-regular text-[var(--color-text-primary)] mr-2 break-words flex-grow">{accommodation.title}</h3>
                )}
                <div className="flex items-center space-x-1 shrink-0 mt-1"> 
                  {isEditingThis ? (
                    <>
                      <button
                        onClick={handleSaveChanges}
                        disabled={editLoading || Object.keys(currentEditData || {}).length === 0} // Disable if no data (shouldn't happen) or loading
                        className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Save changes"
                      >
                        {editLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <Save className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={editLoading}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Cancel edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEditClick(accommodation)}
                      disabled={!!editingAccommodationId} // Disable if ANY row is being edited
                      className={`p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                      aria-label="Edit accommodation"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Body: Editable Fields */} 
              <div className="space-y-2 text-sm text-[var(--color-text-secondary)] flex-grow mb-2"> 
                {isEditingThis && currentEditData ? (
                  <>
                    {/* Type */} 
                    <div>
                        <label htmlFor={`type-${accommodation.id}`} className={labelClassName}>Type</label>
                        <select
                            id={`type-${accommodation.id}`}
                            value={currentEditData.type}
                            onChange={(e) => handleInputChange(e, 'type')}
                            disabled={editLoading}
                            className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")} `}
                        >
                            {/* Optional: Add a default disabled option? */} 
                            {/* <option value="" disabled>Select a type...</option> */} 
                            {ALLOWED_ACCOMMODATION_TYPES.map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option> // Capitalize for display
                            ))}
                        </select>
                    </div>
                     {/* Price */} 
                    <div>
                        <label htmlFor={`price-${accommodation.id}`} className={labelClassName}>Price (€)</label>
                        <input type="number" id={`price-${accommodation.id}`} value={currentEditData.base_price === null || currentEditData.base_price === undefined ? '' : currentEditData.base_price} onChange={(e) => handleInputChange(e, 'base_price')} disabled={editLoading} className={numberInputClassName} step="1" min="0" />
                    </div>
                    {/* Capacity */} 
                    <div>
                        <label htmlFor={`capacity-${accommodation.id}`} className={labelClassName}>Capacity</label>
                        <input type="number" id={`capacity-${accommodation.id}`} value={currentEditData.capacity === null || currentEditData.capacity === undefined ? '' : currentEditData.capacity} onChange={(e) => handleInputChange(e, 'capacity')} disabled={editLoading} className={numberInputClassName} step="1" min="1" />
                    </div>
                     {/* Bed Size */} 
                    <div>
                        <label htmlFor={`bed_size-${accommodation.id}`} className={labelClassName}>Bed Size</label>
                        <input type="text" id={`bed_size-${accommodation.id}`} value={currentEditData.bed_size ?? ''} onChange={(e) => handleInputChange(e, 'bed_size')} disabled={editLoading} className={inputClassName} />
                    </div>
                     {/* Features - Checkboxes */} 
                    <div className='flex flex-col space-y-1 pt-1'>
                         <label className={checkboxLabelClassName}>
                            <input type="checkbox" checked={!!currentEditData.has_wifi} onChange={(e) => handleInputChange(e, 'has_wifi')} disabled={editLoading} className={checkboxInputClassName}/>
                            <span>Has WiFi</span>
                         </label>
                         <label className={checkboxLabelClassName}>
                            <input type="checkbox" checked={!!currentEditData.has_electricity} onChange={(e) => handleInputChange(e, 'has_electricity')} disabled={editLoading} className={checkboxInputClassName}/>
                            <span>Has Electricity</span>
                         </label>
                    </div>
                  </>
                ) : (
                  <> 
                    <p><span className='font-medium'>Type:</span> {accommodation.type}</p>
                    <p><span className='font-medium'>Price:</span> €{accommodation.base_price}</p>
                    <p><span className='font-medium'>Capacity:</span> {accommodation.capacity || 'N/A'}</p>
                    <p><span className='font-medium'>Bed Size:</span> {accommodation.bed_size || 'N/A'}</p>
                    <div className="flex gap-2 pt-1"> 
                      {accommodation.has_wifi && <span className="inline-flex items-center gap-1 bg-[var(--color-bg-success-subtle)] text-[var(--color-text-success)] px-2 py-0.5 rounded text-xs"><Wifi size={12}/> WiFi</span>}
                      {accommodation.has_electricity && <span className="inline-flex items-center gap-1 bg-[var(--color-bg-success-subtle)] text-[var(--color-text-success)] px-2 py-0.5 rounded text-xs"><Zap size={12}/> Electricity</span>}
                      {!accommodation.has_wifi && !accommodation.has_electricity && <span className='text-xs italic'>No listed features.</span>}
                    </div>
                  </>
                )}
              </div>

              {/* Error Display Area */} 
              {isEditingThis && editError && (
                <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                  {editError}
                </div>
              )}
               {/* Global Upload Progress/Error (maybe better placed globally?) */} 
               {/* {uploadProgress > 0 && uploadProgress < 100 && (...)} */} 
               {/* {uploadError && (...)} */} 

            </div>
          );
        })}
      </div>
    </div>
  );
} 