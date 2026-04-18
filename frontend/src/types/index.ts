/**
 * PrivaComply Type Definitions
 */

export interface UserPreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  autoFillEnabled: boolean;
  showWidget: boolean;
}

export interface CookieStats {
  necessary: number;
  functional: number;
  analytics: number;
  advertising: number;
  blocked: number;
}

export interface ClassifiedCookie {
  name: string;
  domain: string;
  path: string;
  label: number;
  category: string;
  blocked: boolean;
  timestamp: number;
}

export interface ScanHistoryItem {
  id: string;
  url: string;
  timestamp: string;
  cookieCount: number;
  blockedCount: number;
}

export type CookieCategory = 'necessary' | 'functional' | 'analytics' | 'advertising';
