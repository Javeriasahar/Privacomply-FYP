import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChromeStorage } from '@/lib/chrome-storage';

export interface SettingsState {
  language: 'en' | 'ur' | 'both';
  theme: 'light' | 'dark' | 'system';
  autoScan: boolean;
  cookieConsent: 'reject-all' | 'accept-all' | 'custom' | 'ask';
  scanDepth: 'quick' | 'standard' | 'deep';
  complianceStandards: ('gdpr' | 'pdpa')[];
  notifications: boolean;
  customCookiePreferences: {
    strictlyNecessary: boolean;
    functionality: boolean;
    analytics: boolean;
    advertising: boolean;
  };
  
  setLanguage: (lang: 'en' | 'ur' | 'both') => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  updateSettings: (settings: Partial<SettingsState>) => void;
  resetSettings: () => void;
}

const defaultSettings: Omit<SettingsState, 'setLanguage' | 'setTheme' | 'updateSettings' | 'resetSettings'> = {
  language: 'en',
  theme: 'system',
  autoScan: false,
  cookieConsent: 'ask',
  scanDepth: 'standard',
  complianceStandards: ['gdpr', 'pdpa'],
  notifications: true,
  customCookiePreferences: {
    strictlyNecessary: true,
    functionality: true,
    analytics: false,
    advertising: false,
  },
};

// Custom storage adapter for Zustand to use ChromeStorage (async)
// Note: Zustand persist mostly expects sync storage by default, but supports async.
// ChromeStorage is async, so we use async storage pattern.
const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await ChromeStorage.get(name, null)) as string | null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await ChromeStorage.set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await ChromeStorage.remove(name);
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'privacomply-settings',
      storage: createJSONStorage(() => storage),
    }
  )
);
