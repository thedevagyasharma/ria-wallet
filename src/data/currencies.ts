export type Currency = {
  code: string;
  name: string;
  flag: string;
  symbol: string;
};

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar',        flag: 'US', symbol: '$' },
  { code: 'EUR', name: 'Euro',             flag: 'EU', symbol: '€' },
  { code: 'GBP', name: 'British Pound',    flag: 'GB', symbol: '£' },
  { code: 'MXN', name: 'Mexican Peso',     flag: 'MX', symbol: '$' },
  { code: 'PHP', name: 'Philippine Peso',  flag: 'PH', symbol: '₱' },
  { code: 'INR', name: 'Indian Rupee',     flag: 'IN', symbol: '₹' },
];

export const getCurrency = (code: string) =>
  CURRENCIES.find((c) => c.code === code)!;

/**
 * Format a monetary amount safely.
 * Always uses 'en-US' number formatting (Hermes supports it universally)
 * and prepends the currency symbol from our curated list.
 * This avoids JSI HostFunction exceptions from unsupported ICU locales
 * (e.g. 'fil-PH', 'ar-MA') in Hermes's Intl implementation.
 */
export const formatAmount = (
  amount: number,
  currencyCode: string,
  opts: { decimals?: number } = {}
): string => {
  const currency = getCurrency(currencyCode);
  const decimals = opts.decimals ?? 2;
  const num = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));
  return `${currency.symbol}${num}`;
};
