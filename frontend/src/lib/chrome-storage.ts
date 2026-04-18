/**
 * Wrapper for Chrome Storage API
 * Handles persistence and type safety
 */
export class ChromeStorage {
  /**
   * Get a value from storage
   * @param key Storage key
   * @param defaultValue Default value if key is not found
   */
  static async get<T>(key: string, defaultValue: T): Promise<T> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      // Fallback for development outside extension capability
      const local = localStorage.getItem(key);
      return (local ? JSON.parse(local) : defaultValue) as T;
    }

    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] !== undefined ? result[key] : defaultValue) as T;
    } catch (error) {
      console.error(`Error getting key ${key} from storage:`, error);
      return defaultValue;
    }
  }

  /**
   * Set a value in storage
   * @param key Storage key
   * @param value Value to store
   */
  static async set<T>(key: string, value: T): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
       localStorage.setItem(key, JSON.stringify(value));
       return;
    }

    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error(`Error setting key ${key} to storage:`, error);
    }
  }

  /**
   * Remove a key from storage
   * @param key Storage key
   */
  static async remove(key: string): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        localStorage.removeItem(key);
        return;
    }
    await chrome.storage.local.remove(key);
  }

  /**
   * Clear all storage
   */
  static async clear(): Promise<void> {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        localStorage.clear();
        return;
    }
    await chrome.storage.local.clear();
  }

  /**
   * Listen for changes
   */
  static onChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): void {
      if (typeof chrome === 'undefined' || !chrome.storage) return;
      chrome.storage.onChanged.addListener(callback);
  }
}
