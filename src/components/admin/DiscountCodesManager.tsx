import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase'; // Assuming supabase client is here
import { Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';

// Basic type for a discount code (align with DB schema later)
interface DiscountCode {
  id: string;
  code: string;
  percentage_discount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  deactivated_at: string | null;
  created_by: string | null;
  updated_at: string;
  applies_to: string;
}

export function DiscountCodesManager() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // State for the add form
  const [newCode, setNewCode] = useState('');
  const [newPercentage, setNewPercentage] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAppliesTo, setNewAppliesTo] = useState('total');
  const [isAdding, setIsAdding] = useState(false);

  // State for delete confirmation
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<DiscountCode | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Fetch codes --- 
  const fetchCodes = useCallback(async () => {
    console.log('Fetching discount codes...');
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null); // Clear messages on fetch

    try {
      const { data, error: fetchError } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching codes:', fetchError);
        throw new Error(fetchError.message || 'Failed to fetch codes.');
      }

      console.log('Fetched codes:', data);
      setCodes(data || []);
    } catch (err: any) {
      setError(`Error loading codes: ${err.message}`);
      setCodes([]); // Clear codes on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  // --- Add Code Handler ---
  const handleAddCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const codeValue = newCode.trim().toUpperCase(); // Standardize to uppercase
    const percentageValue = parseInt(newPercentage, 10);

    // Basic Validation
    if (!codeValue) {
      setError('Code cannot be empty.');
      return;
    }
    if (isNaN(percentageValue) || percentageValue <= 0 || percentageValue > 100) {
      setError('Percentage must be a number between 1 and 100.');
      return;
    }
    // Check for duplicates locally first (basic check)
    if (codes.some(c => c.code.toUpperCase() === codeValue)) {
        setError(`Code '${codeValue}' already exists.`);
        return;
    }

    setIsAdding(true);
    try {
        const { error: insertError } = await supabase
            .from('discount_codes')
            .insert({
                code: codeValue,
                percentage_discount: percentageValue,
                description: newDescription.trim() || null,
                is_active: true, // New codes are active by default
                applies_to: newAppliesTo
            });

        if (insertError) {
            console.error('Error inserting code:', insertError);
            // More specific error for unique constraint violation
            if (insertError.code === '23505') { // PostgreSQL unique violation code
                 setError(`Code '${codeValue}' already exists.`);
            } else {
                 setError(insertError.message || 'Failed to add code.');
            }
            throw new Error(insertError.message);
        }

        setSuccessMessage(`Code '${codeValue}' added successfully!`);
        // Reset form and hide
        setNewCode('');
        setNewPercentage('');
        setNewDescription('');
        setNewAppliesTo('total');
        setShowAddForm(false);
        await fetchCodes(); // Refresh the list

    } catch (err: any) {
        // Error already set in the try block if needed
        console.error("Add code failed", err);
    } finally {
        setIsAdding(false);
    }
  };

  // --- Delete Code Handler ---
  const handleDeleteCode = async () => {
    if (!codeToDelete || deleteConfirmationInput !== codeToDelete.code) {
      setError('Confirmation text does not match the code.'); // Should ideally show in modal
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsDeleting(true);
    console.log(`Attempting to delete code: ${codeToDelete.code} (ID: ${codeToDelete.id})`);

    try {
      const { error: deleteError } = await supabase
        .from('discount_codes')
        .delete()
        .match({ id: codeToDelete.id });

      if (deleteError) {
        console.error('Error deleting code:', deleteError);
        throw new Error(deleteError.message || 'Failed to delete code.');
      }

      setSuccessMessage(`Code '${codeToDelete.code}' deleted successfully.`);
      closeDeleteModal();
      await fetchCodes(); // Refresh list

    } catch (err: any) {
      console.error('Delete code failed', err);
      // setError will be set inside the modal or a general error can be shown.
      // For now, let's set a general error if modal one isn't specific.
      setError(`Failed to delete code: ${err.message}`); 
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (code: DiscountCode) => {
    setCodeToDelete(code);
    setDeleteConfirmationInput(''); // Clear previous input
    setError(null); // Clear previous modal errors
    setSuccessMessage(null); // Clear success messages
    setShowDeleteConfirmModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setCodeToDelete(null);
    setDeleteConfirmationInput('');
    setIsDeleting(false); // Reset deleting state
  };

  // --- Toggle Active State Handler ---
  const handleToggleActive = async (codeToToggle: DiscountCode) => {
    setError(null);
    setSuccessMessage(null);
    const newActiveState = !codeToToggle.is_active;
    console.log(`Toggling code ${codeToToggle.code} to ${newActiveState ? 'active' : 'inactive'}`);

    try {
        const { error: updateError } = await supabase
            .from('discount_codes')
            .update({
                is_active: newActiveState,
                deactivated_at: newActiveState ? null : new Date().toISOString() // Set/clear deactivated timestamp
            })
            .match({ id: codeToToggle.id });

        if (updateError) {
            console.error('Error updating code status:', updateError);
            throw new Error(updateError.message || 'Failed to update code status.');
        }

        setSuccessMessage(`Code '${codeToToggle.code}' ${newActiveState ? 'activated' : 'deactivated'}.`);
        // Update local state optimistically or refetch
        setCodes(currentCodes =>
            currentCodes.map(c =>
                c.id === codeToToggle.id ? { ...c, is_active: newActiveState, deactivated_at: newActiveState ? null : new Date().toISOString() } : c
            )
        );
        // Optionally refetch for consistency: await fetchCodes();

    } catch (err: any) {
         setError(`Failed to update code status: ${err.message}`);
    }
  };

  // --- TODO: Delete Handler (If needed) ---
  // const handleDeleteCode = async (id: string) => { ... };

  return (
    <div className="p-4 sm:p-6 font-mono text-primary">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-display font-light">Manage Codes</h2>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setError(null); // Clear errors when toggling form
            setSuccessMessage(null);
            if (!showAddForm) { // Reset fields when opening
                 setNewCode('');
                 setNewPercentage('');
                 setNewDescription('');
                 setNewAppliesTo('total');
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm bg-emerald-800 text-white hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Cancel' : 'Add Code'}
        </button>
      </div>

      {/* --- Messages --- */} 
      {error && (
        <div className="mb-4 p-3 bg-error-muted text-error rounded-sm text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-success-muted text-success rounded-sm text-sm">
          {successMessage}
        </div>
      )}

      {/* --- Add Form Section --- */}
      {showAddForm && (
         <div className="mb-6 p-4 border border-border rounded-sm bg-surface">
            <h3 className="text-lg font-medium mb-4">Add New Code</h3>
            <form onSubmit={handleAddCode} className="space-y-4">
                <div>
                    <label htmlFor="new-code" className="block text-sm font-medium text-secondary mb-1">Code</label>
                    <input
                        type="text"
                        id="new-code"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value.toUpperCase())} // Force uppercase
                        className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent text-primary placeholder-secondary-muted"
                        placeholder="E.g., SUMMER20"
                        required
                        disabled={isAdding}
                    />
                     <p className="text-xs text-secondary-muted mt-1">Code will be saved in uppercase. Max 50 characters recommended.</p>
                </div>
                <div>
                    <label htmlFor="new-percentage" className="block text-sm font-medium text-secondary mb-1">Percentage Discount (%)</label>
                    <input
                        type="number"
                        id="new-percentage"
                        value={newPercentage}
                        onChange={(e) => setNewPercentage(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent text-primary placeholder-secondary-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="E.g., 15" // Must be between 1 and 100
                        min="1"
                        max="100"
                        step="1"
                        required
                        disabled={isAdding}
                    />
                </div>
                <div>
                    <label htmlFor="new-description" className="block text-sm font-medium text-secondary mb-1">Description (Optional)</label>
                    <input
                        type="text"
                        id="new-description"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent text-primary placeholder-secondary-muted"
                        placeholder="E.g., For summer campaign"
                        disabled={isAdding}
                    />
                </div>
                <div>
                    <label htmlFor="new-applies-to" className="block text-sm font-medium text-secondary mb-1">Applies To</label>
                    <select
                        id="new-applies-to"
                        value={newAppliesTo}
                        onChange={(e) => setNewAppliesTo(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-furface-modal,theme(colors.gray.800))] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent text-primary"
                        disabled={isAdding}
                    >
                        <option value="total">Total Amount</option>
                        <option value="accommodation">Accommodation Only</option>
                        <option value="food_facilities">Food & Facilities Only</option>
                    </select>
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-accent-primary text-stone-800 rounded-md hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isAdding}
                    >
                        {isAdding ? 'Adding...' : 'Add Code'}
                    </button>
                </div>
            </form>
          </div>
      )}

      {isLoading && <p className="text-center text-secondary py-4">Loading codes...</p>}

      {!isLoading && codes.length === 0 && !error && (
        <p className="text-center text-secondary py-4">No codes found. Add one to get started!</p>
      )}

      {/* --- Codes Table --- */}
      {!isLoading && codes.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-sm shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-subtle">
              <tr><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Code</th><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Discount</th><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Description</th><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Applies To</th><th scope="col" className="px-4 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">Active</th><th scope="col" className="px-4 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">Actions</th></tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {codes.map((code) => (
                <tr key={code.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary">{code.code}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{code.percentage_discount}%</td>
                    <td className="px-4 py-3 text-sm text-secondary max-w-xs truncate" title={code.description || ''}>{code.description || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary">
                        {code.applies_to === 'accommodation' ? 'Accommodation' :
                         code.applies_to === 'food_facilities' ? 'Food & Facilities' :
                         'Total Amount'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${code.is_active ? 'bg-[var(--color-accent-primary)] text-[var(--color-badge-active-text)]' : 'bg-[var(--color-error)] text-[var(--color-badge-inactive-text)]'}`}>
                        {code.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2"> {/* Centered Actions */}
                       <button
                            onClick={() => handleToggleActive(code)}
                            title={code.is_active ? 'Deactivate Code' : 'Activate Code'}
                            className={`p-1 rounded transition-colors ${code.is_active ? 'text-secondary hover:text-warning hover:bg-warning-muted' : 'text-secondary hover:text-success hover:bg-success-muted'}`}
                        >
                            {code.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        {/* Optional Delete Button - uncomment if needed and implement handleDelete */}
                        
                        <button
                            onClick={() => openDeleteModal(code)} // Changed from handleDeleteCode to openDeleteModal
                            title="Delete Code Permanently"
                            className="text-secondary hover:text-error p-1 rounded hover:bg-error-muted disabled:opacity-50"
                            disabled={isDeleting} // Disable if a delete is in progress globally, though modal handles its own loading
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && codeToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={closeDeleteModal}>
            <div 
                className="bg-[var(--color-bg-surface)] p-6 md:p-8 rounded-sm shadow-2xl w-full max-w-md border border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
            >
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3 font-display">Confirm Deletion</h2>
                <p className="text-[var(--color-text-secondary)] mb-1">
                    Are you sure you want to permanently delete the discount code:
                </p>
                <p className="text-[var(--color-text-primary)] font-bold text-lg mb-4 bg-surface-subtle p-2 rounded-md text-center">
                    {codeToDelete.code}
                </p>
                
                {error && (
                    <div className="mb-4 p-3 bg-error-muted text-error rounded-sm text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <p className="text-[var(--color-text-secondary)] mb-2 text-sm">
                    To confirm, please type the code <strong className="text-[var(--color-text-primary)]">{codeToDelete.code}</strong> in the box below.
                </p>
                <input
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder={`Type "${codeToDelete.code}" to confirm`}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-accent-error focus:border-accent-error font-mono text-sm mb-6 disabled:opacity-70"
                    disabled={isDeleting}
                />
                <div className="flex justify-end gap-3">
                    <button
                        onClick={closeDeleteModal}
                        className="px-4 py-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors font-mono disabled:opacity-70"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteCode}
                        disabled={isDeleting || deleteConfirmationInput !== codeToDelete.code}
                        className="px-4 py-2 rounded-sm bg-error text-white hover:bg-error-hover transition-colors font-mono flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            'Delete Permanently'
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
} 