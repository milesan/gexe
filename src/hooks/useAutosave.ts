import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAutosave() {
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<any>(null);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const loadSavedData = useCallback(async () => {
    if (initialDataLoaded) return null;

    try {
      console.log('📂 Loading saved application data');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('👤 No user found, skipping load');
        return null;
      }

      const { data: savedData, error } = await supabase
        .from('saved_applications')
        .select('data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      console.log('📥 Loaded saved data:', {
        hasData: !!savedData,
        dataKeys: savedData?.data ? Object.keys(savedData.data) : [],
        hasImageUrls: savedData?.data ? Object.values(savedData.data).some(v => 
          Array.isArray(v) && v.length > 0 && v[0]?.url
        ) : false
      });
      
      setInitialDataLoaded(true);
      setLastSavedData(savedData?.data || null);
      return savedData?.data || null;
    } catch (err) {
      console.error('Error loading saved data:', err);
      return null;
    }
  }, [initialDataLoaded]);

  const saveData = useCallback(async (data: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('💾 Autosave triggered with data:', {
        dataKeys: Object.keys(data),
        hasImageUrls: Object.values(data).some(v => 
          Array.isArray(v) && v.length > 0 && v[0]?.url
        ),
        data: data
      });

      // Only save if data has changed
      if (JSON.stringify(data) === JSON.stringify(lastSavedData)) {
        console.log('📝 No changes detected, skipping save');
        return;
      }

      console.log('🔄 Saving to saved_applications table');
      const { error } = await supabase
        .from('saved_applications')
        .upsert({
          user_id: user.id,
          data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      console.log('✅ Data saved successfully');
      setLastSavedData(data);
      setShowSaveNotification(true);
    } catch (err) {
      console.error('❌ Error saving data:', err);
    }
  }, [lastSavedData]);

  return {
    saveData,
    loadSavedData,
    showSaveNotification,
    setShowSaveNotification
  };
}