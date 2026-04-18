import { create } from 'zustand';

export interface BlockedCookie {
  id: string;
  name: string;
  domain: string;
  category: 'functional' | 'analytics' | 'advertising';
  timestamp: string;
}

interface ViolationState {
  blockedCookies: BlockedCookie[];
  filters: {
    category: string[];
  };
  sortBy: 'category' | 'timestamp' | 'domain';
  addBlockedCookie: (cookie: BlockedCookie) => void;
  setBlockedCookies: (cookies: BlockedCookie[]) => void;
  setFilters: (filters: Partial<ViolationState['filters']>) => void;
  setSortBy: (sortBy: ViolationState['sortBy']) => void;
  clearFilters: () => void;
  clearAll: () => void;
}

export const useViolationStore = create<ViolationState>((set) => ({
  blockedCookies: [],
  filters: {
    category: [],
  },
  sortBy: 'timestamp',

  addBlockedCookie: (cookie) => set((state) => ({
    blockedCookies: [cookie, ...state.blockedCookies].slice(0, 100) // Keep last 100
  })),

  setBlockedCookies: (cookies) => set({ blockedCookies: cookies }),
  
  setFilters: (newFilters) => set((state) => ({ 
    filters: { ...state.filters, ...newFilters } 
  })),
  
  setSortBy: (sortBy) => set({ sortBy }),
  
  clearFilters: () => set({ 
    filters: { category: [] } 
  }),

  clearAll: () => set({ blockedCookies: [] })
}));
