import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('nb-NO', options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStrengthColor(strength: string | null | undefined): string {
  switch (strength) {
    case 'strong': return 'text-green-600 bg-green-100';
    case 'medium': return 'text-yellow-600 bg-yellow-100';
    case 'weak': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getHealthColor(status: string | null | undefined): string {
  switch (status) {
    case 'healthy': return 'text-green-600 bg-green-100';
    case 'warning': return 'text-yellow-600 bg-yellow-100';
    case 'critical': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'active': return 'text-green-600 bg-green-100';
    case 'nuc': return 'text-blue-600 bg-blue-100';
    case 'inactive': return 'text-gray-600 bg-gray-100';
    case 'dead': return 'text-red-600 bg-red-100';
    case 'sold': return 'text-purple-600 bg-purple-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getQueenColorHex(color: string | null | undefined): string {
  switch (color) {
    case 'white': return '#FFFFFF';
    case 'yellow': return '#FFD700';
    case 'red': return '#FF0000';
    case 'green': return '#00FF00';
    case 'blue': return '#0000FF';
    default: return '#CCCCCC';
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' kr';
}
