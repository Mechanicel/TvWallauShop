// Utility helper functions for the Vereins-Shop Frontend

/**
 * Format a number as currency according to locale and currency code
 * @param amount number to format
 * @returns formatted currency string
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

/**
 * Safely parse JSON from localStorage
 * @param key storage key
 * @returns parsed value or null
 */
export function loadFromStorage<T>(key: string): T | null {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) as T : null;
    } catch {
        console.warn(`Failed to parse localStorage key "${key}"`);
        return null;
    }
}

/**
 * Save a value to localStorage as JSON
 * @param key storage key
 * @param value value to save
 */
export function saveToStorage<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        console.warn(`Failed to stringify localStorage key "${key}"`);
    }
}

/**
 * Remove an item from localStorage
 * @param key storage key
 */
export function removeFromStorage(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        console.warn(`Failed to remove localStorage key "${key}"`);
    }
}
