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
  Users,
  Tag,
  Home,
  GraduationCap,
  PawPrint,
  Pill,
  Smartphone,
  Bus,
  Film,
  Gamepad2,
  BookOpen,
  Briefcase,
  Landmark,
  Receipt,
  Sparkles,
  Hammer,
  Music,
  type LucideIcon
} from 'lucide-react';

/** Icons the user can pick for a category (stored by lucide name in the Categories table's Icon column) */
export const PICKABLE_ICONS: Record<string, LucideIcon> = {
  Tag, UtensilsCrossed, Coffee, ShoppingCart, ShoppingBag, Shirt, Car, Fuel, Bus, Plane, Home, Sofa, Hammer, Wrench,
  Heart, Pill, Scissors, Wind, Baby, Users, PawPrint, GraduationCap, BookOpen, Dumbbell, Tv, Film, Music, Gamepad2,
  Smartphone, Gift, Sparkles, Briefcase, Landmark, Receipt, TrendingUp, Package,
};

// Category name → chosen icon name, kept in step with the feed (useFeed registers it)
let chosen = new Map<string, string>();
export function registerCategoryIcons(cats: Array<{ name: string; icon: string }>) {
  chosen = new Map(cats.map(c => [c.name, c.icon]));
}

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
  const picked = chosen.get(categoryName);
  if (picked && picked !== 'Tag' && PICKABLE_ICONS[picked]) return PICKABLE_ICONS[picked];
  return CATEGORY_ICONS[categoryName] || (picked ? Tag : HelpCircle);
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
