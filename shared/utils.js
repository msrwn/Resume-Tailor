import * as crypto from 'crypto';
/**
 * Sanitize a path segment for use in filesystem paths.
 * Removes illegal characters, trims whitespace, collapses underscores.
 */
export function sanitizePathSegment(input, maxLength = 80) {
    if (!input)
        return '';
    let sanitized = input
        .trim()
        .replace(/[/\\:*?"<>|]/g, '_') // Replace illegal chars
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .replace(/\.+$/, ''); // Remove trailing dots (Windows doesn't allow folder names ending with dots)
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized || 'unnamed';
}
/**
 * Format date as YYYY_MM_DD for folder naming.
 * Uses America/New_York timezone.
 */
export function formatDateFolder(date = new Date()) {
    // Convert to America/Los_Angeles timezone
    const laDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = laDate.getFullYear();
    const month = String(laDate.getMonth() + 1).padStart(2, '0');
    const day = String(laDate.getDate()).padStart(2, '0');
    return `${year}_${month}_${day}`;
}
/**
 * Compute SHA-256 hash of input string.
 */
export function sha256(input) {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
/**
 * Get first N characters of a hash (for short identifiers).
 */
export function hashShort(hash, length = 8) {
    return hash.substring(0, length);
}
