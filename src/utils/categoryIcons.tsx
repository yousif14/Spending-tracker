/**
 * @fileoverview Category Icon Mapping
 *
 * Maps category names to appropriate icons for visual consistency
 */

import {
  Car,
  Shirt,
  Coffee,
  Zap,
  UtensilsCrossed,
  Sofa,
  Gift,
  ShoppingCart,
  Scissors,
  Heart,
  TrendingUp,
  Wind,
  Package,
  Fuel,
  ShoppingBag,
  Dumbbell,
  Tv,
  Plane,
  HelpCircle,
  Baby,
  Wrench,
  Users
} from 'lucide-react';

/**
 * Icon component mapping for categories
 */
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Transportation
  'Car': Car,
  'Patrol': Fuel,
  'Petrol': Fuel,
  'Travel': Plane,

  // Food & Drink
  'Food': UtensilsCrossed,
  'Drink': Coffee,
  'Groceries': ShoppingCart,

  // Shopping & Lifestyle
  'Shopping': ShoppingBag,
  'Clothing': Shirt,
  'Furniture': Sofa,
  'Gifts': Gift,

  // Personal Care
  'Grooming': Scissors,
  'Health Care': Heart,
  'Laundry': Wind,
  'Luandry': Wind, // Typo variant

  // Entertainment & Services
  'Sport': Dumbbell,
  'Subscription': Tv,
  'Services': Wrench,
  'Gathering': Users,
  'Baby': Baby,

  // Financial
  'Investment': TrendingUp,
  'Fawri+': Zap,

  // Other
  'other': Package,
  'Other': Package,
};

/**
 * Get icon component for a category
 * @param categoryName - Name of the category
 * @returns Icon component or default HelpCircle
 */
export function getCategoryIcon(categoryName: string): React.ComponentType<{ className?: string }> {
  return CATEGORY_ICONS[categoryName] || HelpCircle;
}

/**
 * Render category icon with consistent styling
 * @param categoryName - Name of the category
 * @param className - Additional CSS classes
 * @returns JSX element
 */
export function CategoryIcon({
  categoryName,
  className = "w-5 h-5"
}: {
  categoryName: string;
  className?: string;
}) {
  const Icon = getCategoryIcon(categoryName);
  return <Icon className={className} />;
}
