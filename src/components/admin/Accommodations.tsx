import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Image as ImageIcon, X, Check, Save, Pencil, Wifi, Zap, Plus, Trash2, Camera, Trash, Info, Tag, MapPin } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';

interface AccommodationImage {
  id: string;
  accommodation_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

interface Accommodation {
  id: string;
  title: string;
  base_price: number;
  type: string;
  inventory: number;
  capacity: number;
  has_wifi: boolean;
  has_electricity: boolean;
  is_unlimited: boolean;
  bed_size: string;
  images?: AccommodationImage[]; // New field for multiple images
}

interface AccommodationItem {
  id: string;
  accommodation_id: string;
  zone: 'T' | 'G' | 'C' | 'M' | 'N' | 'U' | 'L' | 'P' | null;
  type: 'BT' | 'PT' | 'TP' | 'VC' | 'TC';
  size: '2' | '3' | '4' | '5' | '6' | 'tent' | 'van';
  item_id: number;
  full_tag?: string;
  accommodation_title?: string;
  accommodation_type?: string;
}

// Helper type for subset of fields allowed for editing
type EditableAccommodationFields = Omit<Accommodation, 'id' | 'is_unlimited' | 'images'>;

// Template for new accommodation
type NewAccommodationData = EditableAccommodationFields;

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

// Error Modal Component
interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string;
  title?: string;
}

function ErrorModal({ isOpen, onClose, error, title = "Error" }: ErrorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[var(--color-bg-surface)] rounded-sm p-4 sm:p-6 max-w-md w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 color-text-primary backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-2 sm:top-4 right-2 sm:right-4 color-shade-2 hover:color-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-display color-text-primary">{title}</h3>
            </div>

            <p className="color-shade-2 mb-6 font-mono text-sm">
              {error}
            </p>
            
            <button
              onClick={onClose}
              className="w-full bg-accent-primary text-black py-2 rounded-sm transition-colors hover:brightness-90 font-mono"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Accommodations() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [accommodationItems, setAccommodationItems] = useState<AccommodationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingAccommodationId, setEditingAccommodationId] = useState<string | null>(null);
  // State to hold the *copy* of the data being edited
  const [currentEditData, setCurrentEditData] = useState<Accommodation | null>(null);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  
  // Add new accommodation states
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newAccommodationData, setNewAccommodationData] = useState<NewAccommodationData | null>(null);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Delete confirmation states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  
  // Accommodation items editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemZone, setEditingItemZone] = useState<string | null>('');
  const [editingItemIdValue, setEditingItemIdValue] = useState<number | null>(null);
  const [itemEditLoading, setItemEditLoading] = useState<boolean>(false);
  const [itemEditError, setItemEditError] = useState<string | null>(null);
  
  // New accommodation item creation states
  const [isCreatingNewItem, setIsCreatingNewItem] = useState<boolean>(false);
  const [newItemData, setNewItemData] = useState<{
    accommodation_id: string;
    type: 'BT' | 'PT' | 'TP' | 'VC' | 'TC';
    size: '2' | '3' | '4' | '5' | '6' | 'tent' | 'van';
    zone: string | null;
  } | null>(null);
  const [createItemLoading, setCreateItemLoading] = useState<boolean>(false);
  const [createItemError, setCreateItemError] = useState<string | null>(null);
  
  // Accommodation item deletion states
  const [deleteItemConfirmId, setDeleteItemConfirmId] = useState<string | null>(null);
  const [deleteItemLoading, setDeleteItemLoading] = useState<string | null>(null);
  
  // Accommodation items filtering states
  const [itemFilters, setItemFilters] = useState<{
    zone: string | null;
    type: string | null;
    size: string | null;
    accommodation: string | null;
  }>({
    zone: null,
    type: null,
    size: null,
    accommodation: null
  });
  const [showItemFilters, setShowItemFilters] = useState<boolean>(false);
  
  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    error: string;
    title: string;
  }>({
    isOpen: false,
    error: '',
    title: 'Error'
  });

  useEffect(() => {
    fetchAccommodations();
    fetchAccommodationItems();
  }, []);

  const fetchAccommodations = async () => {
    try {
      // Fetch accommodations and their images
      const { data: accommodationsData, error: accommodationsError } = await supabase
        .from('accommodations')
        .select('*')
        .order('title');

      if (accommodationsError) throw accommodationsError;

      // Fetch all images for all accommodations
      const { data: imagesData, error: imagesError } = await supabase
        .from('accommodation_images')
        .select('*')
        .order('display_order');

      if (imagesError) throw imagesError;

      // Combine the data
      const accommodationsWithImages = (accommodationsData || []).map(acc => {
        const accommodationImages = (imagesData || []).filter(img => img.accommodation_id === acc.id);
        return {
          ...acc,
          images: accommodationImages
        };
      });

      setAccommodations(accommodationsWithImages);
    } catch (error) {
      console.error('Error fetching accommodations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccommodationItems = async () => {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('accommodation_items_with_tags')
        .select('*')
        .order('full_tag');

      if (itemsError) throw itemsError;
      setAccommodationItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching accommodation items:', error);
    }
  };

  // Get primary image (NEW IMAGES TABLE ONLY)
  const getPrimaryImageUrl = (accommodation: Accommodation): string | null => {
    // Only check new images table for primary image
    const primaryImage = accommodation.images?.find(img => img.is_primary);
    if (primaryImage) return primaryImage.image_url;
    
    // No fallback to old image_url field - only use new table
    return null;
  };

  // Get all images for display (NEW IMAGES TABLE ONLY)
  const getAllImages = (accommodation: Accommodation): AccommodationImage[] => {
    return accommodation.images || [];
  };

  // Initialize new accommodation form
  const handleCreateNewClick = () => {
    console.log('[ACCOM] Create New Mode Activated');
    setIsCreatingNew(true);
    setNewAccommodationData({
      title: '',
      base_price: 0,
      type: 'room', // Default to first type
      inventory: 1,
      capacity: 1, // Add default capacity
      has_wifi: false,
      has_electricity: false,
      bed_size: ''
    });
    setCreateError(null);
    setCreateLoading(false);
  };

  // Cancel new accommodation creation
  const handleCancelCreate = () => {
    console.log('[ACCOM] Create Cancelled');
    setIsCreatingNew(false);
    setNewAccommodationData(null);
    setCreateError(null);
    setCreateLoading(false);
  };

  // Handle input changes for new accommodation
  const handleNewAccommodationInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    fieldName: keyof NewAccommodationData
  ) => {
    if (!newAccommodationData) return;

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
         return;
       }
    }

    console.log('[ACCOM] New Accommodation Input Change:', { fieldName, processedValue });
    setNewAccommodationData({
      ...newAccommodationData,
      [fieldName]: processedValue,
    });
  };

  // Save new accommodation
  const handleSaveNewAccommodation = async () => {
    if (!newAccommodationData) {
        console.error('[ACCOM] Create Error: No data to save.');
        setCreateError("Cannot create, no data provided.");
        return;
    }

    setCreateLoading(true);
    setCreateError(null);
    console.log('[ACCOM] Attempting Create:', { data: newAccommodationData });

    // --- Validation (similar to edit validation) ---
    const errors: string[] = [];
    const dataToSave: NewAccommodationData = { ...newAccommodationData };

    // Title validation
    const title = String(dataToSave.title).trim();
    if (!title) {
        errors.push("Title cannot be empty.");
    } else {
        dataToSave.title = title;
    }

    // Base Price validation
    const base_price_str = String(dataToSave.base_price).trim();
    const base_price_num = parseInt(base_price_str, 10);
    if (base_price_str === '' || isNaN(base_price_num) || base_price_num < 0 || !Number.isInteger(base_price_num) || String(base_price_num) !== base_price_str) {
        errors.push("Price must be a non-negative whole number.");
    } else {
        dataToSave.base_price = base_price_num;
    }

    // Type validation
    const type = String(dataToSave.type).trim();
     if (!type) {
         errors.push("Type cannot be empty.");
     } else if (!ALLOWED_ACCOMMODATION_TYPES.includes(type)) {
         errors.push(`Invalid type selected: ${type}. Allowed types: ${ALLOWED_ACCOMMODATION_TYPES.join(', ')}`);
     } else {
         dataToSave.type = type;
     }

    // Inventory validation
     const inventory_str = String(dataToSave.inventory).trim();
     const inventory_num = parseInt(inventory_str, 10);
     if (inventory_str === '' || isNaN(inventory_num) || inventory_num <= 0 || !Number.isInteger(inventory_num) || String(inventory_num) !== inventory_str) {
         errors.push("Inventory must be a positive whole number.");
     } else {
         dataToSave.inventory = inventory_num;
     }

     // Capacity validation
     const capacity_str = String(dataToSave.capacity).trim();
     const capacity_num = parseInt(capacity_str, 10);
     if (capacity_str === '' || isNaN(capacity_num) || capacity_num <= 0 || !Number.isInteger(capacity_num) || String(capacity_num) !== capacity_str) {
         errors.push("Capacity must be a positive whole number.");
     } else {
         dataToSave.capacity = capacity_num;
     }

     // Bed Size (optional)
     const bed_size = String(dataToSave.bed_size ?? '').trim();
     dataToSave.bed_size = bed_size;

    if (errors.length > 0) {
      const errorMessage = errors.join(' ');
      console.error('[ACCOM] Create Validation Error:', { errors });
      setCreateError(errorMessage);
      setCreateLoading(false);
      return;
    }

    // --- Perform Create ---
    try {
      console.log('[ACCOM] Creating in Supabase:', { data: dataToSave });
      const { data: createdData, error: createError } = await supabase
        .from('accommodations')
        .insert([{
          ...dataToSave,
          is_unlimited: false // Default value
        }])
        .select()
        .single();

      if (createError) throw createError;

      console.log('[ACCOM] Create Successful:', { id: createdData.id });

      // Add to local state immediately for responsiveness
      setAccommodations(prev => [...prev, createdData].sort((a, b) => a.title.localeCompare(b.title)));

      handleCancelCreate(); // Exit create mode

    } catch (err: any) {
      console.error('[ACCOM] Supabase Create Error:', err);
      setCreateError(err.message || "Failed to create accommodation.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Delete confirmation handlers
  const handleDeleteClick = (accommodationId: string) => {
    console.log('[ACCOM] Delete Requested:', { id: accommodationId });
    setDeleteConfirmId(accommodationId);
  };

  const handleCancelDelete = () => {
    console.log('[ACCOM] Delete Cancelled');
    setDeleteConfirmId(null);
  };

  const handleConfirmDelete = async (accommodationId: string) => {
    setDeleteLoading(accommodationId);
    console.log('[ACCOM] Confirming Delete:', { id: accommodationId });

    try {
      const { error: deleteError } = await supabase
        .from('accommodations')
        .delete()
        .eq('id', accommodationId);

      if (deleteError) throw deleteError;

      console.log('[ACCOM] Delete Successful:', { id: accommodationId });

      // Remove from local state immediately
      setAccommodations(prev => prev.filter(acc => acc.id !== accommodationId));
      setDeleteConfirmId(null);

    } catch (err: any) {
      console.error('[ACCOM] Supabase Delete Error:', err);
      // Could set a delete error state here if needed
      alert(`Failed to delete accommodation: ${err.message}`);
    } finally {
      setDeleteLoading(null);
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

    // Inventory (example: required, positive integer)
     const inventory_str = String(currentEditData.inventory).trim();
     const inventory_num = parseInt(inventory_str, 10);
     if (inventory_str === '' || isNaN(inventory_num) || inventory_num <= 0 || !Number.isInteger(inventory_num) || String(inventory_num) !== inventory_str) {
         errors.push("Inventory must be a positive whole number.");
     } else if (!originalAccommodation || inventory_num !== originalAccommodation.inventory) {
         dataToSave.inventory = inventory_num;
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

  // Handle multiple image upload
  const handleMultipleImageUpload = async (files: FileList, accommodationId: string) => {
    const fileArray = Array.from(files);
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      await handleSingleImageUpload(file, accommodationId, i);
    }
  };

  // Handle single image upload to new table
  const handleSingleImageUpload = async (file: File, accommodationId: string, displayOrder: number = 0) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload only image files');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setUploadError(null);
    setUploadProgress({ [accommodationId]: 0 });

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

      // Get current max display order
      const { data: maxOrderData } = await supabase
        .from('accommodation_images')
        .select('display_order')
        .eq('accommodation_id', accommodationId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].display_order + 1 : 0;

      // Check if this should be primary (first image)
      const { data: existingImages } = await supabase
        .from('accommodation_images')
        .select('id')
        .eq('accommodation_id', accommodationId);

      const isPrimary = !existingImages || existingImages.length === 0;

      // Insert into new images table
      const { error: insertError } = await supabase
        .from('accommodation_images')
        .insert({
          accommodation_id: accommodationId,
          image_url: publicUrl,
          display_order: nextOrder,
          is_primary: isPrimary
        });

      if (insertError) throw insertError;
      console.log('✅ Image added to database:', { publicUrl, accommodationId });

      // Update local state
      await fetchAccommodations();
      setUploadProgress({ [accommodationId]: 100 });

    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload image');
      setUploadProgress({ [accommodationId]: 0 });
    }
  };

  // Delete an image
  const handleDeleteImage = async (imageId: string, accommodationId: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      console.log('🗑️ Deleting image:', { imageId, accommodationId });
      
      const { error } = await supabase
        .from('accommodation_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
      console.log('✅ Image deleted:', { imageId });

      // Update local state
      await fetchAccommodations();

    } catch (err: any) {
      console.error('Delete error:', err);
      setUploadError(err.message || 'Failed to delete image');
    }
  };

  // Set image as primary
  const handleSetPrimary = async (imageId: string, accommodationId: string) => {
    try {
      console.log('🎯 Setting primary image:', { imageId, accommodationId });
      
      // First, unset all primary flags for this accommodation
      const { error: unsetError } = await supabase
        .from('accommodation_images')
        .update({ is_primary: false })
        .eq('accommodation_id', accommodationId);

      if (unsetError) throw unsetError;

      // Then set the selected image as primary
      const { error: setPrimaryError } = await supabase
        .from('accommodation_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (setPrimaryError) throw setPrimaryError;
      console.log('✅ Primary image set:', { imageId });

      // Update local state
      await fetchAccommodations();

    } catch (err: any) {
      console.error('Set primary error:', err);
      setUploadError(err.message || 'Failed to set primary image');
    }
  };

  // Accommodation Items Management
  const handleEditItemZone = (item: AccommodationItem) => {
    setEditingItemId(item.id);
    setEditingItemZone(item.zone);
    setEditingItemIdValue(item.item_id);
    setItemEditError(null);
  };

  const handleCancelItemEdit = () => {
    setEditingItemId(null);
    setEditingItemZone('');
    setEditingItemIdValue(null);
    setItemEditError(null);
  };

  const handleSaveItemZone = async () => {
    if (!editingItemId || !editingItemZone || editingItemIdValue === null) {
      setErrorModal({
        isOpen: true,
        error: 'Invalid edit state - missing required fields',
        title: 'Validation Error'
      });
      return;
    }

    setItemEditLoading(true);
    setItemEditError(null);

    try {
      const { error } = await supabase
        .from('accommodation_items')
        .update({ 
          zone: editingItemZone as any,
          item_id: editingItemIdValue
        })
        .eq('id', editingItemId);

      if (error) throw error;

      console.log('✅ Item updated:', { id: editingItemId, zone: editingItemZone, item_id: editingItemIdValue });
      
      // Update local state immediately for responsiveness
      setAccommodationItems(prev => 
        prev.map(item => 
          item.id === editingItemId 
            ? { ...item, zone: editingItemZone as any, item_id: editingItemIdValue }
            : item
        )
      );
      
      handleCancelItemEdit();

    } catch (err: any) {
      console.error('Update item error:', err);
      
      // Parse the error message to make it more user-friendly
      let errorMessage = err.message || 'Failed to update item';
      let errorTitle = 'Update Error';
      
      if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
        errorTitle = 'Duplicate ID Error';
        errorMessage = `The ID ${editingItemIdValue} is already taken by another item with the same type and size. Please choose a different ID.`;
      } else if (errorMessage.includes('positive_item_id')) {
        errorTitle = 'Invalid ID Error';
        errorMessage = 'The ID must be a positive number greater than 0.';
      }
      
      setErrorModal({
        isOpen: true,
        error: errorMessage,
        title: errorTitle
      });
    } finally {
      setItemEditLoading(false);
    }
  };

  // New accommodation item creation functions
  const handleCreateNewItemClick = () => {
    setIsCreatingNewItem(true);
    setNewItemData({
      accommodation_id: '',
      type: 'BT',
      size: '4',
      zone: null
    });
    setCreateItemError(null);
  };

  const handleCancelCreateItem = () => {
    setIsCreatingNewItem(false);
    setNewItemData(null);
    setCreateItemError(null);
  };

  const handleNewItemInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    fieldName: 'accommodation_id' | 'type' | 'size' | 'zone'
  ) => {
    if (!newItemData) return;
    
    const value = e.target.value;
    setNewItemData({
      ...newItemData,
      [fieldName]: fieldName === 'zone' ? (value || null) : value
    });
  };

  const handleSaveNewItem = async () => {
    if (!newItemData || !newItemData.accommodation_id) {
      setCreateItemError('Please select an accommodation');
      return;
    }

    setCreateItemLoading(true);
    setCreateItemError(null);

    try {
      // Get the next available item_id for this type and size
      const { data: existingItems, error: fetchError } = await supabase
        .from('accommodation_items')
        .select('item_id')
        .eq('type', newItemData.type)
        .eq('size', newItemData.size)
        .order('item_id', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextItemId = existingItems && existingItems.length > 0 
        ? Math.max(...existingItems.map(item => item.item_id)) + 1 
        : 1;

      // Insert the new accommodation item
      const { error: insertError } = await supabase
        .from('accommodation_items')
        .insert({
          accommodation_id: newItemData.accommodation_id,
          zone: newItemData.zone,
          type: newItemData.type,
          size: newItemData.size,
          item_id: nextItemId
        });

      if (insertError) throw insertError;

      console.log('✅ New accommodation item created:', { 
        accommodation_id: newItemData.accommodation_id,
        type: newItemData.type,
        size: newItemData.size,
        item_id: nextItemId,
        zone: newItemData.zone
      });

      await fetchAccommodationItems();
      handleCancelCreateItem();

    } catch (err: any) {
      console.error('Create accommodation item error:', err);
      setCreateItemError(err.message || 'Failed to create accommodation item');
    } finally {
      setCreateItemLoading(false);
    }
  };

  // Accommodation item deletion functions
  const handleDeleteItemClick = (itemId: string) => {
    console.log('[ACCOM ITEM] Delete Requested:', { id: itemId });
    setDeleteItemConfirmId(itemId);
  };

  const handleCancelDeleteItem = () => {
    console.log('[ACCOM ITEM] Delete Cancelled');
    setDeleteItemConfirmId(null);
  };

  const handleConfirmDeleteItem = async (itemId: string) => {
    setDeleteItemLoading(itemId);
    console.log('[ACCOM ITEM] Confirming Delete:', { id: itemId });

    try {
      const { error: deleteError } = await supabase
        .from('accommodation_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      console.log('[ACCOM ITEM] Delete Successful:', { id: itemId });

      // Remove from local state immediately
      setAccommodationItems(prev => prev.filter(item => item.id !== itemId));
      setDeleteItemConfirmId(null);

    } catch (err: any) {
      console.error('[ACCOM ITEM] Supabase Delete Error:', err);
      alert(`Failed to delete accommodation item: ${err.message}`);
    } finally {
      setDeleteItemLoading(null);
    }
  };

  // Accommodation items filtering functions
  const handleFilterChange = (filterType: keyof typeof itemFilters, value: string | null) => {
    setItemFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setItemFilters({
      zone: null,
      type: null,
      size: null,
      accommodation: null
    });
  };

  const filteredItems = accommodationItems.filter(item => {
    if (itemFilters.zone && item.zone !== itemFilters.zone) return false;
    if (itemFilters.type && item.type !== itemFilters.type) return false;
    if (itemFilters.size && item.size !== itemFilters.size) return false;
    if (itemFilters.accommodation && item.accommodation_id !== itemFilters.accommodation) return false;
    return true;
  });

  const getItemStats = () => {
    const stats = {
      total: accommodationItems.length,
      byZone: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      bySize: {} as Record<string, number>,
      byAccommodation: {} as Record<string, number>
    };

    accommodationItems.forEach(item => {
      // Zone stats
      const zoneKey = item.zone || 'Unknown';
      stats.byZone[zoneKey] = (stats.byZone[zoneKey] || 0) + 1;
      
      // Type stats
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
      
      // Size stats
      stats.bySize[item.size] = (stats.bySize[item.size] || 0) + 1;
      
      // Accommodation stats
      const accommodationTitle = item.accommodation_title || 'Unknown';
      stats.byAccommodation[accommodationTitle] = (stats.byAccommodation[accommodationTitle] || 0) + 1;
    });

    return stats;
  };

  if (loading) {
    return <div className="p-4 text-[var(--color-text-secondary)]">Loading...</div>;
  }

  // Common input styles
  const inputClassName = "w-full px-2 py-1 border border-[var(--color-border)] rounded-sm bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm disabled:opacity-50";
  const numberInputClassName = inputClassName + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const labelClassName = "text-xs font-medium text-[var(--color-text-secondary)] mb-0.5 block"; // Added label style
  const checkboxLabelClassName = "flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer";
  const checkboxInputClassName = "form-checkbox h-4 w-4 text-[var(--color-accent-primary)] bg-[var(--color-input-bg)] border-[var(--color-border)] rounded-sm focus:ring-[var(--color-accent-primary)] focus:ring-offset-0 focus:ring-1 disabled:opacity-50";

  return (
    <div className="p-4">
      <h2 className="text-xl font-display mb-4 text-[var(--color-text-primary)]">Accommodations</h2>
      {/* Global Upload Error Display */} 
      {uploadError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm text-sm">
              Image Upload Error: {uploadError}
          </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create New Accommodation Card */}
        {isCreatingNew ? (
          // Create New Form Card
          <div className="bg-[var(--color-bg-surface)] rounded-sm shadow-sm border border-[var(--color-accent-primary)] ring-1 ring-[var(--color-accent-primary)] p-4 flex flex-col">
            {/* Image Placeholder */}
            <div className="relative aspect-video mb-4 bg-[var(--color-bg-surface-hover)] rounded-sm flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-[var(--color-text-secondary)]" />
              <div className="absolute bottom-2 right-2 text-xs text-[var(--color-text-secondary)]">Upload after creation</div>
            </div>

            {/* Header: Title and Controls */}
            <div className="flex justify-between items-start mb-3">
              <div className='flex-grow mr-2'>
                <label htmlFor="new-title" className={labelClassName}>Title</label>
                <input
                  type="text"
                  id="new-title"
                  value={newAccommodationData?.title || ''}
                  onChange={(e) => handleNewAccommodationInputChange(e, 'title')}
                  disabled={createLoading}
                  className={inputClassName}
                  placeholder="Enter accommodation title"
                />
              </div>
              <div className="flex items-center space-x-1 shrink-0 mt-1">
                <button
                  onClick={handleSaveNewAccommodation}
                  disabled={createLoading || !newAccommodationData}
                  className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Save new accommodation"
                >
                  {createLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <Save className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleCancelCreate}
                  disabled={createLoading}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Cancel creation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body: Form Fields */}
            {newAccommodationData && (
              <div className="space-y-2 text-sm text-[var(--color-text-secondary)] flex-grow mb-2">
                {/* Type */}
                <div>
                  <label htmlFor="new-type" className={labelClassName}>Type</label>
                  <select
                    id="new-type"
                    value={newAccommodationData.type}
                    onChange={(e) => handleNewAccommodationInputChange(e, 'type')}
                    disabled={createLoading}
                    className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")} `}
                  >
                    {ALLOWED_ACCOMMODATION_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                {/* Price */}
                <div>
                  <label htmlFor="new-price" className={labelClassName}>Price (€)</label>
                  <input 
                    type="number" 
                    id="new-price" 
                    value={newAccommodationData.base_price === null || newAccommodationData.base_price === undefined ? '' : newAccommodationData.base_price} 
                    onChange={(e) => handleNewAccommodationInputChange(e, 'base_price')} 
                    disabled={createLoading} 
                    className={numberInputClassName} 
                    step="1" 
                    min="0" 
                    placeholder="0"
                  />
                </div>
                {/* Inventory */}
                <div>
                  <div className="flex items-center gap-1">
                    <label htmlFor="new-inventory" className={labelClassName}>Inventory</label>
                    <Tooltip.Provider>
                      <Tooltip.Root delayDuration={50}>
                        <Tooltip.Trigger asChild>
                          <button className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors">
                            <Info className="w-3 h-3" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content className="tooltip-content !font-mono text-xs z-50" sideOffset={5}>
                            Number of identical units that can be booked separately
                            <Tooltip.Arrow className="tooltip-arrow" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </div>
                  <input 
                    type="number" 
                    id="new-inventory" 
                    value={newAccommodationData.inventory === null || newAccommodationData.inventory === undefined ? '' : newAccommodationData.inventory} 
                    onChange={(e) => handleNewAccommodationInputChange(e, 'inventory')} 
                    disabled={createLoading} 
                    className={numberInputClassName} 
                    step="1" 
                    min="1" 
                    placeholder="1"
                  />
                </div>
                {/* Capacity */}
                <div>
                  <div className="flex items-center gap-1">
                    <label htmlFor="new-capacity" className={labelClassName}>Capacity</label>
                    <Tooltip.Provider>
                      <Tooltip.Root delayDuration={50}>
                        <Tooltip.Trigger asChild>
                          <button className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors">
                            <Info className="w-3 h-3" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content className="tooltip-content !font-mono text-xs z-50" sideOffset={5}>
                            Number of people that can sleep in one unit
                            <Tooltip.Arrow className="tooltip-arrow" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </div>
                  <input 
                    type="number" 
                    id="new-capacity" 
                    value={newAccommodationData.capacity === null || newAccommodationData.capacity === undefined ? '' : newAccommodationData.capacity} 
                    onChange={(e) => handleNewAccommodationInputChange(e, 'capacity')} 
                    disabled={createLoading} 
                    className={numberInputClassName} 
                    step="1" 
                    min="1" 
                    placeholder="1"
                  />
                </div>
                {/* Bed Size */}
                <div>
                  <label htmlFor="new-bed_size" className={labelClassName}>Bed Size</label>
                  <input 
                    type="text" 
                    id="new-bed_size" 
                    value={newAccommodationData.bed_size ?? ''} 
                    onChange={(e) => handleNewAccommodationInputChange(e, 'bed_size')} 
                    disabled={createLoading} 
                    className={inputClassName} 
                    placeholder="e.g. Queen, Twin, etc."
                  />
                </div>
                {/* Features - Checkboxes */}
                <div className='flex flex-col space-y-1 pt-1'>
                  <label className={checkboxLabelClassName}>
                    <input 
                      type="checkbox" 
                      checked={!!newAccommodationData.has_wifi} 
                      onChange={(e) => handleNewAccommodationInputChange(e, 'has_wifi')} 
                      disabled={createLoading} 
                      className={checkboxInputClassName}
                    />
                    <span>Has WiFi</span>
                  </label>
                  <label className={checkboxLabelClassName}>
                    <input 
                      type="checkbox" 
                      checked={!!newAccommodationData.has_electricity} 
                      onChange={(e) => handleNewAccommodationInputChange(e, 'has_electricity')} 
                      disabled={createLoading} 
                      className={checkboxInputClassName}
                    />
                    <span>Has Electricity</span>
                  </label>
                </div>
              </div>
            )}

            {/* Error Display */}
            {createError && (
              <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                {createError}
              </div>
            )}
          </div>
        ) : (
          // Create New Button Card
          <div 
            className="bg-[var(--color-bg-surface)] rounded-sm shadow-sm border border-dashed border-[var(--color-border)] p-4 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-surface-hover)] transition-colors"
            onClick={handleCreateNewClick}
          >
            <div className="aspect-video w-full flex items-center justify-center mb-4">
              <Plus className="w-12 h-12 text-[var(--color-text-secondary)]" />
            </div>
            <h3 className="font-medium text-[var(--color-text-primary)] mb-1">Add New Accommodation</h3>
            <p className="text-sm text-[var(--color-text-secondary)] text-center">Click to create a new accommodation</p>
          </div>
        )}

        {/* Existing Accommodations */}
        {accommodations.map((accommodation) => {
          const isEditingThis = editingAccommodationId === accommodation.id;
          const isDeleteConfirming = deleteConfirmId === accommodation.id;
          const isDeleting = deleteLoading === accommodation.id;
          
          return (
            <div key={accommodation.id} className={`bg-[var(--color-bg-surface)] rounded-sm shadow-sm border ${isEditingThis ? 'border-[var(--color-accent-primary)] ring-1 ring-[var(--color-accent-primary)]' : 'border-[var(--color-border)]'} p-4 flex flex-col`}>
              {/* Image Section - Updated for Multiple Images */}
              <div className="relative mb-4 group">
                {(() => {
                  const allImages = getAllImages(accommodation);
                  const primaryImageUrl = getPrimaryImageUrl(accommodation);
                  
                  if (allImages.length === 0) {
                    // No images
                    return (
                      <div className="aspect-video w-full bg-[var(--color-bg-surface-hover)] rounded-sm flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-[var(--color-text-secondary)]" />
                      </div>
                    );
                  } else if (allImages.length === 1) {
                    // Single image
                    return (
                      <div className="aspect-video relative">
                        <img
                          src={primaryImageUrl || ''}
                          alt={accommodation.title}
                          className="w-full h-full object-cover rounded-sm"
                        />
                        <button
                          onClick={() => handleDeleteImage(allImages[0].id, accommodation.id)}
                          disabled={isEditingThis}
                          className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white rounded-sm text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 flex items-center gap-1"
                          aria-label="Remove image"
                        >
                          <Trash className="w-3 h-3" />
                          <span>Remove image</span>
                        </button>
                      </div>
                    );
                  } else {
                    // Multiple images - show gallery
                    return (
                      <div className="space-y-2">
                        {/* Primary Image */}
                        <div className="aspect-video relative">
                                                  <img
                          src={primaryImageUrl || ''}
                          alt={accommodation.title}
                          className="w-full h-full object-cover rounded-sm"
                        />
                        <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-sm text-xs font-semibold">
                            Primary
                          </div>
                        </div>
                        
                        {/* Thumbnail Gallery */}
                        <div className="grid grid-cols-4 gap-1">
                          {allImages.map((image, index) => (
                            <div key={image.id} className="relative aspect-square group/thumb">
                              <img
                                src={image.image_url}
                                alt={`${accommodation.title} ${index + 1}`}
                                className={`w-full h-full object-cover rounded-sm cursor-pointer ${
                                  image.is_primary ? 'ring-2 ring-green-500' : 'opacity-70 hover:opacity-100'
                                }`}
                                onClick={() => !image.is_primary && handleSetPrimary(image.id, accommodation.id)}
                              />
                              {!image.is_primary && (
                                <button
                                  onClick={() => handleDeleteImage(image.id, accommodation.id)}
                                  disabled={isEditingThis}
                                  className="absolute -top-1 -right-1 px-1 py-0.5 bg-red-500 text-white rounded-sm text-xs opacity-0 group-hover/thumb:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 flex items-center gap-0.5 whitespace-nowrap"
                                  aria-label="Remove image"
                                >
                                  <X className="w-2 h-2" />
                                  <span className="text-xs">Remove</span>
                                </button>
                              )}
                              {image.is_primary && (
                                <div className="absolute -top-1 -right-1 p-0.5 bg-green-500 text-white rounded-sm">
                                  <Check className="w-2 h-2" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                })()}
                
                {/* Upload Controls */}
                <div className="absolute bottom-2 right-2 flex gap-1">
                  {/* Multiple Image Upload */}
                  <label className={`bg-[var(--color-bg-surface-transparent)] backdrop-blur-sm p-2 rounded-sm shadow-sm cursor-pointer transition-colors ${isEditingThis ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}`}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={isEditingThis}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          handleMultipleImageUpload(files, accommodation.id);
                        }
                      }}
                    />
                    <Camera className="w-4 h-4 text-blue-300" />
                  </label>
                </div>
              </div>

              {/* Header: Title and Edit/Save/Cancel/Delete Controls */}
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
                  <h3 className="font-semi-bold font-mono text-[var(--color-text-primary)] mr-2 break-words flex-grow">{accommodation.title}</h3>
                )}
                <div className="flex items-center space-x-1 shrink-0 mt-1"> 
                  {isEditingThis ? (
                    <>
                      <button
                        onClick={handleSaveChanges}
                        disabled={editLoading || Object.keys(currentEditData || {}).length === 0} // Disable if no data (shouldn't happen) or loading
                        className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Save changes"
                      >
                        {editLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <Save className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={editLoading}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Cancel edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : isDeleteConfirming ? (
                    <>
                      <button
                        onClick={() => handleConfirmDelete(accommodation.id)}
                        disabled={isDeleting}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Confirm delete"
                      >
                        {isDeleting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        disabled={isDeleting}
                        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Cancel delete"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditClick(accommodation)}
                        disabled={!!editingAccommodationId || isCreatingNew} // Disable if ANY row is being edited or creating
                        className={`p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                        aria-label="Edit accommodation"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(accommodation.id)}
                        disabled={!!editingAccommodationId || isCreatingNew} // Disable if ANY row is being edited or creating
                        className={`p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                        aria-label="Delete accommodation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Delete Confirmation Message */}
              {isDeleteConfirming && (
                <div className="mb-3 p-2 bg-red-900/30 border border-red-700/50 rounded-md">
                  <p className="text-sm text-red-400 font-medium">Are you sure you want to delete this accommodation?</p>
                  <p className="text-xs text-red-400 mt-1">This action cannot be undone.</p>
                </div>
              )}

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
                    {/* Inventory */} 
                    <div>
                        <div className="flex items-center gap-1">
                          <label htmlFor={`inventory-${accommodation.id}`} className={labelClassName}>Inventory</label>
                          <Tooltip.Provider>
                            <Tooltip.Root delayDuration={50}>
                              <Tooltip.Trigger asChild>
                                <button className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors">
                                  <Info className="w-3 h-3" />
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content !font-mono text-xs z-50" sideOffset={5}>
                                  Number of identical units that can be booked separately
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>
                        </div>
                        <input type="number" id={`inventory-${accommodation.id}`} value={currentEditData.inventory === null || currentEditData.inventory === undefined ? '' : currentEditData.inventory} onChange={(e) => handleInputChange(e, 'inventory')} disabled={editLoading} className={numberInputClassName} step="1" min="1" />
                    </div>
                     {/* Capacity */} 
                    <div>
                        <div className="flex items-center gap-1">
                          <label htmlFor={`capacity-${accommodation.id}`} className={labelClassName}>Capacity</label>
                          <Tooltip.Provider>
                            <Tooltip.Root delayDuration={50}>
                              <Tooltip.Trigger asChild>
                                <button className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors">
                                  <Info className="w-3 h-3" />
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content !font-mono text-xs z-50" sideOffset={5}>
                                  Number of people that can sleep in one unit
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>
                        </div>
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
                    <div className="flex items-center gap-1">
                      <p><span className='font-medium'>Inventory:</span> {accommodation.inventory || 'N/A'}</p>
                      <Tooltip.Provider>
                        <Tooltip.Root delayDuration={50}>
                          <Tooltip.Trigger asChild>
                            <button className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors">
                              <Info className="w-3 h-3" />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content !font-mono text-xs z-50" sideOffset={5}>
                              Number of identical units that can be booked separately
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    </div>
                    <div className="flex items-center gap-1">
                      <p><span className='font-medium'>Capacity:</span> {accommodation.capacity || 'N/A'}</p>
                      <Tooltip.Provider>
                        <Tooltip.Root delayDuration={50}>
                          <Tooltip.Trigger asChild>
                            <button className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors">
                              <Info className="w-3 h-3" />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content !font-mono text-xs z-50" sideOffset={5}>
                              Number of people that can sleep in one unit
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    </div>
                    <p><span className='font-medium'>Bed Size:</span> {accommodation.bed_size || 'N/A'}</p>
                    <div className="flex gap-2 pt-1"> 
                      {accommodation.has_wifi && <span className="inline-flex items-center gap-1 bg-[var(--color-bg-success-subtle)] text-[var(--color-text-success)] px-2 py-0.5 rounded-sm text-xs"><Wifi size={12}/> WiFi</span>}
                      {accommodation.has_electricity && <span className="inline-flex items-center gap-1 bg-[var(--color-bg-success-subtle)] text-[var(--color-text-success)] px-2 py-0.5 rounded-sm text-xs"><Zap size={12}/> Electricity</span>}
                      {!accommodation.has_wifi && !accommodation.has_electricity && <span className='text-xs italic'>No listed features.</span>}
                    </div>
                  </>
                )}
              </div>

              {/* Error Display Area */} 
              {isEditingThis && editError && (
                <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded-sm text-sm">
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

      {/* Accommodation Items Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-display text-[var(--color-text-primary)] flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Accommodation Items & Tags
          </h3>
                      <button
              onClick={() => setShowItemFilters(!showItemFilters)}
              className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-surface-hover)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)] rounded-sm transition-colors"
            >
            <span>Filters</span>
            <span className="text-xs bg-emerald-900 text-white px-1.5 py-0.5 rounded-sm">
              {Object.values(itemFilters).filter(Boolean).length}
            </span>
          </button>
        </div>
        
                    {itemEditError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm text-sm">
                {itemEditError}
              </div>
            )}

        {createItemError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm text-sm">
            {createItemError}
          </div>
        )}

        {/* Filters Panel */}
        {showItemFilters && (
          <div className="mb-4 p-4 bg-[var(--color-bg-surface-hover)] rounded-sm border border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Filters</h4>
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Zone Filter */}
              <div>
                <label className={labelClassName}>Zone</label>
                <select
                  value={itemFilters.zone || ''}
                  onChange={(e) => handleFilterChange('zone', e.target.value || null)}
                  className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                >
                  <option value="">All Zones</option>
                  <option value="">Unknown</option>
                  <option value="T">T - Tipiland</option>
                  <option value="G">G - Grove</option>
                  <option value="C">C - Tennis Court</option>
                  <option value="M">M - Microcabins</option>
                  <option value="N">N - Containers</option>
                  <option value="U">U - Upper Glamping Plateau</option>
                  <option value="L">L - Lower Glamping Plateau</option>
                  <option value="P">P - Parking</option>
                </select>
              </div>
              
              {/* Type Filter */}
              <div>
                <label className={labelClassName}>Type</label>
                <select
                  value={itemFilters.type || ''}
                  onChange={(e) => handleFilterChange('type', e.target.value || null)}
                  className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                >
                  <option value="">All Types</option>
                  <option value="BT">BT - Bell Tent</option>
                  <option value="PT">PT - Pumpkin-Shaped Bell Tent</option>
                  <option value="TP">TP - Tipi</option>
                  <option value="VC">VC - DIY Van</option>
                  <option value="TC">TC - DIY Tent</option>
                </select>
              </div>
              
              {/* Size Filter */}
              <div>
                <label className={labelClassName}>Size</label>
                <select
                  value={itemFilters.size || ''}
                  onChange={(e) => handleFilterChange('size', e.target.value || null)}
                  className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                >
                  <option value="">All Sizes</option>
                  <option value="2">2 - 2.2m Tipi (Single)</option>
                  <option value="3">3 - 3m Tipi (Double)</option>
                  <option value="4">4 - 4m Bell tent</option>
                  <option value="5">5 - 5m Bell tent</option>
                  <option value="6">6 - 6m Bell tent</option>
                  <option value="tent">Tent - Your Own Tent</option>
                  <option value="van">Van - Van Parking</option>
                </select>
              </div>
              
              {/* Accommodation Filter */}
              <div>
                <label className={labelClassName}>Accommodation</label>
                <select
                  value={itemFilters.accommodation || ''}
                  onChange={(e) => handleFilterChange('accommodation', e.target.value || null)}
                  className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                >
                  <option value="">All Accommodations</option>
                  {accommodations
                    .filter(acc => acc.type === 'tent' || acc.type === 'parking' || acc.type === 'addon')
                    .map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.title}</option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Summary */}
        <div className="mb-4 p-4 bg-[var(--color-bg-surface-hover)] rounded-sm border border-[var(--color-border)]">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Total Items:</span>
              <span className="bg-emerald-900 text-white px-2 py-1 rounded-sm text-xs font-mono">
                {getItemStats().total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Filtered:</span>
              <span className="bg-blue-900 text-white px-2 py-1 rounded-sm text-xs font-mono">
                {filteredItems.length}
              </span>
            </div>
            {Object.entries(getItemStats().byZone).map(([zone, count]) => (
              <div key={zone} className="flex items-center gap-2">
                <span className="font-medium">{zone}:</span>
                <span className="bg-gray-700 text-white px-2 py-1 rounded-sm text-xs font-mono">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-bg-surface)] rounded-sm border border-[var(--color-border)] p-4">
          {/* Create New Accommodation Item Form */}
          {isCreatingNewItem ? (
            <div className="mb-6 p-4 bg-[var(--color-bg-surface-hover)] rounded-sm border border-[var(--color-accent-primary)] ring-1 ring-[var(--color-accent-primary)]">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Create New Accommodation Item</h4>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSaveNewItem}
                    disabled={createItemLoading || !newItemData}
                    className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Save new item"
                  >
                    {createItemLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <Save className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancelCreateItem}
                    disabled={createItemLoading}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Cancel creation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {newItemData && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  {/* Accommodation Selection */}
                  <div>
                    <label className={labelClassName}>Accommodation</label>
                    <select
                      value={newItemData.accommodation_id}
                      onChange={(e) => handleNewItemInputChange(e, 'accommodation_id')}
                      disabled={createItemLoading}
                      className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                    >
                      <option value="">Select accommodation...</option>
                      {accommodations
                        .filter(acc => acc.type === 'tent' || acc.type === 'parking' || acc.type === 'addon')
                        .map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.title}</option>
                        ))}
                    </select>
                  </div>
                  
                  {/* Zone Selection */}
                  <div>
                    <label className={labelClassName}>Zone</label>
                    <select
                      value={newItemData.zone || ''}
                      onChange={(e) => handleNewItemInputChange(e, 'zone')}
                      disabled={createItemLoading}
                      className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                    >
                      <option value="">None (Unknown)</option>
                      <option value="T">T - Tipiland</option>
                      <option value="G">G - Grove</option>
                      <option value="C">C - Tennis Court</option>
                      <option value="M">M - Microcabins</option>
                      <option value="N">N - Containers</option>
                      <option value="U">U - Upper Glamping Plateau</option>
                      <option value="L">L - Lower Glamping Plateau</option>
                      <option value="P">P - Parking</option>
                    </select>
                  </div>
                  
                  {/* Type Selection */}
                  <div>
                    <label className={labelClassName}>Type</label>
                    <select
                      value={newItemData.type}
                      onChange={(e) => handleNewItemInputChange(e, 'type')}
                      disabled={createItemLoading}
                      className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                    >
                      <option value="BT">BT - Bell Tent</option>
                      <option value="PT">PT - Pumpkin-Shaped Bell Tent</option>
                      <option value="TP">TP - Tipi</option>
                      <option value="VC">VC - DIY Van</option>
                      <option value="TC">TC - DIY Tent</option>
                    </select>
                  </div>
                  
                  {/* Size Selection */}
                  <div>
                    <label className={labelClassName}>Size</label>
                    <select
                      value={newItemData.size}
                      onChange={(e) => handleNewItemInputChange(e, 'size')}
                      disabled={createItemLoading}
                      className={`${inputClassName.replace("bg-[var(--color-input-bg)]", "bg-[var(--color-furface-modal,theme(colors.gray.800))]")}`}
                    >
                      <option value="2">2 - 2.2m Tipi (Single)</option>
                      <option value="3">3 - 3m Tipi (Double)</option>
                      <option value="4">4 - 4m Bell tent</option>
                      <option value="5">5 - 5m Bell tent</option>
                      <option value="6">6 - 6m Bell tent</option>
                      <option value="tent">Tent - Your Own Tent</option>
                      <option value="van">Van - Van Parking</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <button
                onClick={handleCreateNewItemClick}
                disabled={isCreatingNewItem}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-emerald-900 hover:bg-emerald-800 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add New Accommodation Item
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const isEditingThis = editingItemId === item.id;
              
              return (
                <div key={item.id} className="bg-[var(--color-bg-surface-hover)] rounded-sm border border-[var(--color-border)] p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-medium bg-emerald-900 text-white px-2 py-1 rounded-sm">
                          {item.full_tag}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {item.accommodation_title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditingThis ? (
                        <>
                          <button
                            onClick={handleSaveItemZone}
                            disabled={itemEditLoading}
                            className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Save zone"
                          >
                            {itemEditLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <Save className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={handleCancelItemEdit}
                            disabled={itemEditLoading}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Cancel edit"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : deleteItemConfirmId === item.id ? (
                        <>
                          <button
                            onClick={() => handleConfirmDeleteItem(item.id)}
                            disabled={deleteItemLoading === item.id}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Confirm delete"
                          >
                            {deleteItemLoading === item.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={handleCancelDeleteItem}
                            disabled={deleteItemLoading === item.id}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Cancel delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditItemZone(item)}
                            disabled={!!editingItemId || !!deleteItemConfirmId}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Edit item"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItemClick(item.id)}
                            disabled={!!editingItemId || !!deleteItemConfirmId}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                    <div className="flex justify-between">
                      <span>Zone:</span>
                      {isEditingThis ? (
                        <select
                          value={editingItemZone || ''}
                          onChange={(e) => setEditingItemZone(e.target.value || null)}
                          disabled={itemEditLoading}
                          className="text-xs bg-[var(--color-furface-modal,theme(colors.gray.800))] border border-[var(--color-border)] rounded-sm px-1 py-0.5"
                        >
                          <option value="">None (Unknown)</option>
                          <option value="T">T - Tipiland</option>
                          <option value="G">G - Grove</option>
                          <option value="C">C - Tennis Court</option>
                          <option value="M">M - Microcabins</option>
                          <option value="N">N - Containers</option>
                          <option value="U">U - Upper Glamping Plateau</option>
                          <option value="L">L - Lower Glamping Plateau</option>
                          <option value="P">P - Parking</option>
                        </select>
                      ) : (
                        <span className="font-mono">
                          {item.zone ? `${item.zone} - ${
                            item.zone === 'T' ? 'Tipiland' :
                            item.zone === 'G' ? 'Grove' :
                            item.zone === 'C' ? 'Tennis Court' :
                            item.zone === 'M' ? 'Microcabins' :
                            item.zone === 'N' ? 'Containers' :
                            item.zone === 'U' ? 'Upper Glamping Plateau' :
                            item.zone === 'L' ? 'Lower Glamping Plateau' :
                            item.zone === 'P' ? 'Parking' : 'Unknown'
                          }` : '?? - Unknown'}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-mono">
                        {item.type} - {
                          item.type === 'BT' ? 'Bell Tent' :
                          item.type === 'PT' ? 'Pumpkin-Shaped Bell Tent' :
                          item.type === 'TP' ? 'Tipi' :
                          item.type === 'VC' ? 'DIY Van' :
                          item.type === 'TC' ? 'DIY Tent' : 'Unknown'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-mono">
                        {item.size} - {
                          item.size === '2' ? '2.2m Tipi (Single)' :
                          item.size === '3' ? '3m Tipi (Double)' :
                          item.size === '4' ? '4m Bell tent' :
                          item.size === '5' ? '5m Bell tent' :
                          item.size === '6' ? '6m Bell tent' : 'Unknown'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ID:</span>
                      {isEditingThis ? (
                        <input
                          type="number"
                          value={editingItemIdValue || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value > 0) {
                              setEditingItemIdValue(value);
                            } else if (e.target.value === '') {
                              setEditingItemIdValue(null);
                            }
                          }}
                          disabled={itemEditLoading}
                          className="text-xs bg-[var(--color-furface-modal,theme(colors.gray.800))] border border-[var(--color-border)] rounded-sm px-1 py-0.5 w-12 text-right font-mono"
                          min="1"
                          step="1"
                        />
                      ) : (
                        <span className="font-mono">{item.item_id.toString().padStart(2, '0')}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Delete Confirmation Message */}
                  {deleteItemConfirmId === item.id && (
                    <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 rounded-md">
                      <p className="text-sm text-red-400 font-medium">Are you sure you want to delete this accommodation item?</p>
                      <p className="text-xs text-red-400 mt-1">This action cannot be undone.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ErrorModal 
        isOpen={errorModal.isOpen} 
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
        error={errorModal.error}
        title={errorModal.title}
      />
    </div>
  );
} 
