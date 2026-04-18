
import { create } from 'zustand';

export interface CookieInfo {
  name: string;
  domain: string;
  category: string;
  label: number;
  blocked: boolean;
}

export interface ScanResults {
  url: string;
  timestamp: string;
  cookies: CookieInfo[];
  summary: {
    total: number;
    necessary: number;
    functional: number;
    analytics: number;
    advertising: number;
    blocked: number;
  };
}

interface ScanState {
  isScanning: boolean;
  currentUrl: string;
  scanResults: ScanResults | null;
  scanProgress: number;
  scanStep: string;
  startScan: (url: string) => Promise<void>;
  cancelScan: () => void;
  clearResults: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  isScanning: false,
  currentUrl: '',
  scanResults: null,
  scanProgress: 0,
  scanStep: '',
  
  startScan: async (url: string) => {
    set({ isScanning: true, currentUrl: url, scanProgress: 0, scanResults: null, scanStep: 'Initializing...' });
    
    const steps = [
      { progress: 25, label: 'Loading cookies...' },
      { progress: 50, label: 'Classifying cookies...' },
      { progress: 75, label: 'Applying policy...' },
      { progress: 100, label: 'Complete' },
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ scanProgress: step.progress, scanStep: step.label });
    }

    // Get stats from background
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_COOKIE_STATS' });
      if (response?.success && response.stats) {
        const stats = response.stats;
        set({ 
          isScanning: false, 
          scanResults: {
            url,
            timestamp: new Date().toISOString(),
            cookies: [],
            summary: {
              total: stats.necessary + stats.functional + stats.analytics + stats.advertising,
              necessary: stats.necessary,
              functional: stats.functional,
              analytics: stats.analytics,
              advertising: stats.advertising,
              blocked: stats.blocked
            }
          },
          scanStep: 'Complete'
        });
      } else {
        set({ isScanning: false, scanStep: 'Complete' });
      }
    } catch {
      set({ isScanning: false, scanStep: 'Error' });
    }
  },

  cancelScan: () => {
    set({ isScanning: false, scanProgress: 0, scanStep: 'Cancelled' });
  },

  clearResults: () => {
    set({ scanResults: null, currentUrl: '', scanProgress: 0, scanStep: '' });
  }
}));
