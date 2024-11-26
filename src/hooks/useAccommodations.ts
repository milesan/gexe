import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Accommodation = Database['public']['Tables']['accommodations']['Row'];

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function fetchWithRetry(retries = 0): Promise<Accommodation[]> {
  try {
    const { data, error } = await supabase
      .from('accommodations')
      .select('*')
      .order('price', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.warn(`Fetch attempt ${retries + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(retries + 1);
    }
    throw error;
  }
}

export function useAccommodations() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    async function loadAccommodations() {
      try {
        setError(null);
        const data = await fetchWithRetry();
        
        if (isMounted) {
          setAccommodations(data);
        }
      } catch (e) {
        console.error('Error loading accommodations:', e);
        if (isMounted) {
          setError(e instanceof Error ? e : new Error('Failed to load accommodations'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    // Initial load
    loadAccommodations();

    // Subscribe to changes
    subscription = supabase
      .channel('accommodations_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'accommodations' 
        }, 
        () => {
          loadAccommodations();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { accommodations, loading, error };
}