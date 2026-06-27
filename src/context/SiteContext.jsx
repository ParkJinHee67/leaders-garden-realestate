/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SiteContext = createContext();

export function SiteProvider({ children }) {
  const [siteSettings, setSiteSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (!supabase) {
          setLoading(false);
          return;
        }
        
        const { data, error } = await supabase
          .from('agencies')
          .select('*')
          .limit(1)
          .single();
          
        if (error) throw error;
        setSiteSettings(data);
      } catch (error) {
        console.error('Failed to fetch site settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <SiteContext.Provider value={siteSettings}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteContext);
}
