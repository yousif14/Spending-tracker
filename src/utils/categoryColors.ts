/**
 * @fileoverview Category Color Management
 *
 * Provides consistent color mapping for categories across the entire application.
 * Colors are deterministically assigned based on category names to ensure
 * the same category always has the same color on all pages.
 */

/**
 * Predefined color palette for categories
 * Modern, vibrant colors optimized for dark/light themes
 */
const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#A855F7', // Violet
  '#F43F5E', // Rose
  '#22D3EE', // Sky
  '#FCD34D', // Yellow
  '#34D399', // Emerald
];

/**
 * Simple hash function to convert string to number
 * @param str - String to hash
 * @returns Number hash
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a consistent color for a category name
 *
 * @param categoryName - Name of the category
 * @returns Hex color code
 *
 * @example
 * getCategoryColor('Food') // Always returns the same color
 * getCategoryColor('Transport') // Always returns the same color
 */
export function getCategoryColor(categoryName: string): string {
  const hash = hashString(categoryName.toLowerCase());
  const index = hash % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

/**
 * Get colors for multiple categories
 *
 * @param categories - Array of category names or category objects
 * @returns Map of category names to colors
 *
 * @example
 * const colors = getCategoryColors(['Food', 'Transport', 'Shopping']);
 * // { 'Food': '#3B82F6', 'Transport': '#10B981', ... }
 */
export function getCategoryColors(
  categories: string[] | Array<{ name: string }>
): Record<string, string> {
  const colorMap: Record<string, string> = {};

  categories.forEach((cat) => {
    const name = typeof cat === 'string' ? cat : cat.name;
    colorMap[name] = getCategoryColor(name);
  });

  return colorMap;
}

/**
 * Override colors from API with consistent colors
 * This ensures backend-provided colors are replaced with our consistent palette
 *
 * @param categories - Categories with potential color field
 * @returns Categories with consistent colors
 */
export function applyConsistentColors<T extends { name: string; color?: string }>(
  categories: T[]
): T[] {
  return categories.map(cat => ({
    ...cat,
    color: getCategoryColor(cat.name)
  }));
}
