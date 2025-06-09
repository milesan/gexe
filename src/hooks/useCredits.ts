import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Global state to share between all useCredits instances
const globalCreditsState = {
  credits: 0,
  loading: true,
  error: null as Error | null,
  subscribers: new Set<() => void>(),
  channel: null as any,
  currentUserId: null as string | null // Track current user
};

let isInitialized = false;

export function useCredits() {
  const [credits, setCredits] = useState<number>(globalCreditsState.credits);
  const [loading, setLoading] = useState(globalCreditsState.loading);
  const [error, setError] = useState<Error | null>(globalCreditsState.error);

  // Subscribe to global state changes
  useEffect(() => {
    const updateState = () => {
      setCredits(globalCreditsState.credits);
      setLoading(globalCreditsState.loading);
      setError(globalCreditsState.error);
    };

    globalCreditsState.subscribers.add(updateState);

    return () => {
      globalCreditsState.subscribers.delete(updateState);
      
      // If no more subscribers, cleanup global state
      if (globalCreditsState.subscribers.size === 0) {
        console.log('[CreditsGlobal] No more subscribers, cleaning up global state');
        cleanup();
      }
    };
  }, []);

  // Check for user changes and reinitialize if needed
  useEffect(() => {
    const checkUserChange = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const newUserId = user?.id || null;
      
      // If user changed, reset everything
      if (globalCreditsState.currentUserId !== newUserId) {
        console.log('[CreditsGlobal] User changed from', globalCreditsState.currentUserId, 'to', newUserId);
        await resetGlobalState(newUserId);
      } else if (!isInitialized) {
        // First time initialization
        isInitialized = true;
        await initializeGlobalState();
      }
    };

    checkUserChange();
  }, []);

  const refresh = useCallback(async () => {
    console.log('[CreditsGlobal] Manual refresh requested');
    try {
      await loadCredits();
      console.log('[CreditsGlobal] Manual refresh completed successfully');
    } catch (err) {
      console.error('[CreditsGlobal] Manual refresh failed:', err);
      throw err;
    }
  }, []);

  return { credits, loading, error, refresh };
}

function cleanup() {
  // Clean up subscription
  if (globalCreditsState.channel) {
    globalCreditsState.channel.unsubscribe();
    globalCreditsState.channel = null;
  }
  
  // Reset initialization flag
  isInitialized = false;
  
  // Reset state
  globalCreditsState.currentUserId = null;
  globalCreditsState.credits = 0;
  globalCreditsState.loading = true;
  globalCreditsState.error = null;
}

async function resetGlobalState(newUserId: string | null) {
  console.log('[CreditsGlobal] Resetting global state for new user:', newUserId);
  
  // Clean up old subscription
  if (globalCreditsState.channel) {
    globalCreditsState.channel.unsubscribe();
    globalCreditsState.channel = null;
  }
  
  // Reset state
  globalCreditsState.currentUserId = newUserId;
  globalCreditsState.credits = 0;
  globalCreditsState.loading = true;
  globalCreditsState.error = null;
  
  // Notify subscribers of reset
  globalCreditsState.subscribers.forEach(callback => callback());
  
  // Initialize for new user
  if (newUserId) {
    await initializeGlobalState();
  } else {
    // No user, just set loading to false
    updateGlobalState({ loading: false });
  }
}

async function initializeGlobalState() {
  console.log('[CreditsGlobal] Initializing global credits state...');
  
  // First load credits
  await loadCredits();

  // Set up subscription
  await setupSubscription();
}

async function setupSubscription() {
  // Get the current user ID for the subscription filter
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[CreditsGlobal] No user found, skipping subscription setup');
    return;
  }

  console.log('[CreditsGlobal] Setting up subscription for user:', user.id);

  // Clean up existing subscription if any
  if (globalCreditsState.channel) {
    console.log('[CreditsGlobal] Cleaning up existing subscription');
    globalCreditsState.channel.unsubscribe();
  }

  // Subscribe to changes for this specific user
  globalCreditsState.channel = supabase
    .channel(`profile_changes_${user.id}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, 
      (payload) => {
        console.log('[CreditsGlobal] Profile changed! Payload:', payload);
        console.log('[CreditsGlobal] Event type:', payload.eventType);
        console.log('[CreditsGlobal] New data:', payload.new);
        console.log('[CreditsGlobal] Old data:', payload.old);
        
        // Add a small delay to ensure database transaction is complete
        setTimeout(() => {
          console.log('[CreditsGlobal] Loading credits after subscription event...');
          loadCredits();
        }, 100);
      }
    )
    .subscribe((status) => {
      console.log('[CreditsGlobal] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[CreditsGlobal] Successfully subscribed to profile changes');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[CreditsGlobal] Subscription channel error');
      } else if (status === 'TIMED_OUT') {
        console.error('[CreditsGlobal] Subscription timed out');
      } else if (status === 'CLOSED') {
        console.log('[CreditsGlobal] Subscription closed');
      }
    });
}

async function loadCredits() {
  try {
    updateGlobalState({ loading: true });
    console.log('[CreditsGlobal] Loading credits...');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[CreditsGlobal] No user, setting credits to 0');
      updateGlobalState({ credits: 0, loading: false, error: null });
      return;
    }

    // Double-check user hasn't changed while we were loading
    if (globalCreditsState.currentUserId && globalCreditsState.currentUserId !== user.id) {
      console.log('[CreditsGlobal] User changed during load, aborting');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[CreditsGlobal] Error loading credits:', error);
      updateGlobalState({ error, loading: false });
      return;
    }
    
    const newCredits = data?.credits || 0;
    console.log('[CreditsGlobal] Loaded credits for user', user.id, ':', newCredits);
    updateGlobalState({ credits: newCredits, loading: false, error: null });
  } catch (err) {
    console.error('Error loading credits:', err);
    const error = err instanceof Error ? err : new Error('Failed to load credits');
    updateGlobalState({ error, loading: false });
  }
}

function updateGlobalState(updates: Partial<typeof globalCreditsState>) {
  Object.assign(globalCreditsState, updates);
  
  // Notify all subscribers
  globalCreditsState.subscribers.forEach(callback => callback());
}