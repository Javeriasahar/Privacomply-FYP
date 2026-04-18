import { create } from 'zustand';

export interface TrackerEntry {
  domain: string;
  category: string;
  requestCount: number;
  requestTypes: string[];
}

export interface TrackerData {
  url: string;
  timestamp: string;
  trackers: TrackerEntry[];
  summary: {
    total: number;
    advertising: number;
    analytics: number;
    social: number;
    cdn: number;
    email: number;
    unknown: number;
  };
}

interface TrackerState {
  isLoading: boolean;
  trackerData: TrackerData | null;
  loadTrackers: () => Promise<void>;
  clearTrackers: () => void;
}

export const useTrackerStore = create<TrackerState>((set) => ({
  isLoading: false,
  trackerData: null,

  loadTrackers: async () => {
    set({ isLoading: true });
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TRACKER_DATA' });
      if (response?.success && response.data) {
        set({ trackerData: response.data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  clearTrackers: () => {
    set({ trackerData: null });
  }
}));
