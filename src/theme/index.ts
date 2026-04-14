export const colors = {
  // Brand — Tailwind orange
  brand: '#f97316',        // orange-500
  brandDark: '#ea580c',    // orange-600
  brandLight: '#fb923c',   // orange-400
  brandSubtle: '#fff7ed',  // orange-50

  // Backgrounds — Tailwind zinc (light mode)
  bg: '#ffffff',           // white
  surface: '#f4f4f5',      // zinc-100
  surfaceHigh: '#e4e4e7',  // zinc-200
  border: '#d4d4d8',       // zinc-300
  borderSubtle: '#f4f4f5', // zinc-100

  // Text — Tailwind zinc (light mode)
  textPrimary: '#18181b',  // zinc-900
  textSecondary: '#71717a',// zinc-500
  textMuted: '#a1a1aa',    // zinc-400

  // Semantic
  success: '#16a34a',      // green-600
  successSubtle: '#dcfce7',// green-100
  pending: '#d97706',      // amber-600
  pendingSubtle: '#fef9c3',// yellow-100
  failed: '#dc2626',       // red-600
  failedSubtle: '#fee2e2', // red-100

  // Wallet card gradients (always dark — these are the credit card faces)
  walletGradients: {
    USD: ['#0c1a3d', '#1e3a6e'],
    MXN: ['#0c2e14', '#134d22'],
    PHP: ['#2e0c3d', '#4d1366'],
    INR: ['#3d1f0c', '#6b3510'],
    NGN: ['#0c2e0c', '#134d13'],
    GBP: ['#0c0c3d', '#13136b'],
    EUR: ['#0c2233', '#134a66'],
    GTQ: ['#0c2e1a', '#134d2a'],
    HNL: ['#0c1a2e', '#133052'],
    DOP: ['#3d0c0c', '#6b1313'],
    COP: ['#2e220c', '#4d3a10'],
    MAD: ['#2e1a0c', '#4d2c10'],
  } as Record<string, [string, string]>,
};

export const typography = {
  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 42,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
