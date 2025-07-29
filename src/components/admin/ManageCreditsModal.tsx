import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Plus, Minus, Euro, Clock } from 'lucide-react';

interface Application {
  id: string;
  user_id: string;
  user_email: string;
  credits?: number;
}

interface ManageCreditsModalProps {
  application: Application;
  onClose: () => void;
  onCreditsUpdated: (userId: string, newBalance: number) => void;
}

interface CreditTransaction {
  id: string;
  amount: number;
  new_balance: number;
  transaction_type: string;
  notes?: string;
  created_at: string;
  admin_email?: string;
}

const TRANSACTION_TYPES = [
  { value: 'admin_add', label: 'Admin Credit' },
  { value: 'admin_remove', label: 'Admin Debit' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'manual_refund', label: 'Manual Refund' }
] as const;

export function ManageCreditsModal({ application, onClose, onCreditsUpdated }: ManageCreditsModalProps) {
  const [currentCredits, setCurrentCredits] = useState<number>(application.credits || 0);
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [transactionType, setTransactionType] = useState<string>('admin_add');
  const [operation, setOperation] = useState<'add' | 'remove' | 'set'>('add');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // Load current credits and transaction history
  useEffect(() => {
    loadInitialCredits();
    loadTransactionHistory();
  }, [application.user_id]);

  const loadInitialCredits = async () => {
    try {
      // Get current credits from profiles
      console.log('Loading user data for user_id:', application.user_id);
      console.log('Application object:', application);
      
      // TEMP: Use the credits from the application object since RLS is blocking direct query
      if (application.credits !== undefined) {
        console.log('Using credits from application object:', application.credits);
        setCurrentCredits(application.credits);
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', application.user_id)
          .maybeSingle();
        
        console.log('Profile query result:', { profileData, profileError });
        
        if (profileError) throw profileError;
        
        const credits = profileData?.credits || 0;
        console.log('Setting current credits to:', credits);
        setCurrentCredits(credits);
      }
    } catch (err) {
      console.error('Error loading initial credits:', err);
      setError(err instanceof Error ? err.message : 'Failed to load credits');
    }
  };

  const loadTransactionHistory = async () => {
    try {
      setLoadingTransactions(true);
      
      // Get recent transactions
      const { data: transactionData, error: transactionError } = await supabase
        .from('credit_transactions')
        .select(`
          id,
          amount,
          new_balance,
          transaction_type,
          notes,
          created_at,
          admin_id
        `)
        .eq('user_id', application.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionError) throw transactionError;

      // Get admin emails by checking profiles for those admin_ids
      const adminIds = [...new Set(transactionData?.filter(t => t.admin_id).map(t => t.admin_id) || [])];
      let adminEmailMap: Record<string, string> = {};

      if (adminIds.length > 0) {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', adminIds);

        adminEmailMap = (adminProfiles || []).reduce((acc, profile) => {
          acc[profile.id] = profile.email;
          return acc;
        }, {} as Record<string, string>);
      }

      // Transform the data to include admin email
      const formattedTransactions = (transactionData || []).map(t => ({
        ...t,
        admin_email: t.admin_id ? (adminEmailMap[t.admin_id] || 'Admin') : 'System'
      }));

      setTransactions(formattedTransactions);
    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) {
      setError('Please enter an amount');
      return;
    }
    
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) {
      setError('Please enter a valid number');
      return;
    }
    
    // For add/remove operations, amount must be positive
    if (operation !== 'set' && amountValue <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    
    // For set operation, amount can be 0 or positive
    if (operation === 'set' && amountValue < 0) {
      setError('Balance cannot be negative');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let newBalance: number;

      if (operation === 'set') {
        // For setting absolute amount, we need to calculate if we're adding or removing
        const difference = amountValue - currentCredits;
        if (difference > 0) {
          // Need to add credits
          const { data, error } = await supabase.rpc('admin_add_credits', {
            p_user_id: application.user_id,
            p_amount: difference,
            p_admin_note: notes || `Set credits to ${amountValue}`
          });
          if (error) throw error;
          newBalance = data;
        } else if (difference < 0) {
          // Need to remove credits
          const { data, error } = await supabase.rpc('admin_remove_credits', {
            p_user_id: application.user_id,
            p_amount: Math.abs(difference),
            p_admin_note: notes || `Set credits to ${amountValue}`
          });
          if (error) throw error;
          newBalance = data;
        } else {
          // No change needed
          newBalance = currentCredits;
        }
      } else if (operation === 'add') {
        const { data, error } = await supabase.rpc('admin_add_credits', {
          p_user_id: application.user_id,
          p_amount: amountValue,
          p_admin_note: notes || 'Admin added credits'
        });
        if (error) throw error;
        newBalance = data;
      } else {
        // remove
        const { data, error } = await supabase.rpc('admin_remove_credits', {
          p_user_id: application.user_id,
          p_amount: amountValue,
          p_admin_note: notes || 'Admin removed credits'
        });
        if (error) throw error;
        newBalance = data;
      }

      console.log('RPC call successful, newBalance:', newBalance);
      setCurrentCredits(newBalance);
      onCreditsUpdated(application.user_id, newBalance);
      
      // Reset form
      setAmount('');
      setNotes('');
      
      // Reload transaction history only (not the credits balance)
      console.log('Reloading transaction history...');
      await loadTransactionHistory();
      
    } catch (err) {
      console.error('Error updating credits:', err);
      setError(err instanceof Error ? err.message : 'Failed to update credits');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes('add') || type === 'promotional' || type === 'manual_refund') {
      return <Plus className="w-3 h-3 text-green-400" />;
    }
    return <Minus className="w-3 h-3 text-red-400" />;
  };

  const getTransactionColor = (amount: number) => {
    return amount > 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-surface)] p-6 md:p-8 rounded-sm shadow-2xl w-full max-w-2xl border border-[var(--color-border)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] font-mono">Manage Credits</h2>
            <p className="text-sm text-[var(--color-text-secondary)] font-mono mt-1">
              {application.user_email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-sm bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance */}
        <div className="bg-[var(--color-bg-main)] p-4 rounded-sm mb-6 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <Euro className="w-5 h-5 text-[var(--color-accent-primary)]" />
            <span className="text-sm font-medium text-[var(--color-text-secondary)] font-mono">Current Balance</span>
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
            {currentCredits.toLocaleString()} credits
          </div>
        </div>

        {/* Operations Form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Operation Type */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-2">
                Operation
              </label>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value as 'add' | 'remove' | 'set')}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-sm bg-gray-800 text-gray-200 focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm hover:bg-gray-700 cursor-pointer"
              >
                <option value="add">Add Credits</option>
                <option value="remove">Remove Credits</option>
                <option value="set">Set Balance</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-2">
                {operation === 'set' ? 'New Balance' : 'Amount'}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm"
                required
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !amount}
                className={`w-full px-4 py-2 rounded-sm font-mono text-sm flex items-center justify-center gap-2 transition-colors ${
                  loading || !amount
                    ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                    : operation === 'remove'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    {operation === 'add' && <Plus className="w-4 h-4" />}
                    {operation === 'remove' && <Minus className="w-4 h-4" />}
                    {operation === 'set' && <Euro className="w-4 h-4" />}
                    {operation === 'set' ? 'Set Balance' : operation === 'add' ? 'Add Credits' : 'Remove Credits'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-2">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for credit adjustment..."
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm"
            />
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 text-red-400 rounded-sm border border-red-700/50 font-mono text-sm">
            {error}
          </div>
        )}

        {/* Transaction History */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[var(--color-text-secondary)]" />
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] font-mono">Recent Transactions</h3>
          </div>

          {loadingTransactions ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-accent-primary)]"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-4 text-[var(--color-text-secondary)] font-mono text-sm">
              No transactions found
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex justify-between items-center p-3 bg-[var(--color-bg-main)] rounded-sm border border-[var(--color-border)]"
                >
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium font-mono ${getTransactionColor(transaction.amount)}`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                          → {transaction.new_balance.toLocaleString()}
                        </span>
                      </div>
                      {transaction.notes && (
                        <div className="text-xs text-[var(--color-text-secondary)] font-mono">
                          {transaction.notes}
                        </div>
                      )}
                      <div className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        by {transaction.admin_email} • {formatDate(transaction.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 