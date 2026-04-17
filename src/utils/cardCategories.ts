import {
  ShoppingCart, Fuel, Coffee, Tv, Music, ShoppingBag,
  UtensilsCrossed, Package, Layers, Utensils, Plane,
  Car, CreditCard,
} from 'lucide-react-native';
import type { CardCategory } from '../stores/types';

export type CategoryMeta = {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  iconColor: string;
  bgColor: string;
};

export const CATEGORY_META: Record<CardCategory, CategoryMeta> = {
  groceries:     { label: 'Groceries',     Icon: ShoppingCart,    iconColor: '#0d9488', bgColor: '#ccfbf1' },
  fuel:          { label: 'Fuel',          Icon: Fuel,            iconColor: '#d97706', bgColor: '#fef3c7' },
  coffee:        { label: 'Coffee',        Icon: Coffee,          iconColor: '#92400e', bgColor: '#fef3c7' },
  streaming:     { label: 'Streaming',     Icon: Tv,              iconColor: '#9333ea', bgColor: '#f3e8ff' },
  music:         { label: 'Music',         Icon: Music,           iconColor: '#ec4899', bgColor: '#fce7f3' },
  shopping:      { label: 'Shopping',      Icon: ShoppingBag,     iconColor: '#2563eb', bgColor: '#dbeafe' },
  food_delivery: { label: 'Food delivery', Icon: UtensilsCrossed, iconColor: '#ea580c', bgColor: '#ffedd5' },
  delivery:      { label: 'Delivery',      Icon: Package,         iconColor: '#0284c7', bgColor: '#e0f2fe' },
  software:      { label: 'Software',      Icon: Layers,          iconColor: '#4f46e5', bgColor: '#e0e7ff' },
  dining:        { label: 'Dining',        Icon: Utensils,        iconColor: '#b45309', bgColor: '#fef3c7' },
  travel:        { label: 'Travel',        Icon: Plane,           iconColor: '#0369a1', bgColor: '#e0f2fe' },
  transport:     { label: 'Transport',     Icon: Car,             iconColor: '#475569', bgColor: '#f1f5f9' },
  other:         { label: 'Other',         Icon: CreditCard,      iconColor: '#71717a', bgColor: '#f4f4f5' },
};
