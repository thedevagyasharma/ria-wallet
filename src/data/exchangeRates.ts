/**
 * Fabricated exchange rates (base: USD).
 * All rates are approximate real-world values for realism.
 */
const USD_RATES: Record<string, number> = {
  USD: 1,
  MXN: 17.15,
  PHP: 56.80,
  INR: 83.50,
  NGN: 1550,
  GBP: 0.79,
  EUR: 0.92,
  GTQ: 7.78,
  HNL: 24.65,
  DOP: 58.90,
  COP: 3950,
  MAD: 9.95,
};

/** Get exchange rate from one currency to another. */
export function getRate(from: string, to: string): number {
  const fromUSD = USD_RATES[from] ?? 1;
  const toUSD = USD_RATES[to] ?? 1;
  return toUSD / fromUSD;
}

/**
 * Compute the transfer fee for a given amount and source currency.
 * Simple tiered model:
 *  - $0–49:   $1.99 flat
 *  - $50–199: $2.99 flat
 *  - $200+:   1% of amount, max $9.99
 */
export function getFee(amount: number, fromCurrency: string): number {
  // Normalise to USD equivalent first
  const usdAmount = amount / (USD_RATES[fromCurrency] ?? 1);
  if (usdAmount < 50)  return 1.99 * (USD_RATES[fromCurrency] ?? 1);
  if (usdAmount < 200) return 2.99 * (USD_RATES[fromCurrency] ?? 1);
  return Math.min(amount * 0.01, 9.99 * (USD_RATES[fromCurrency] ?? 1));
}

/** Estimated delivery time string. */
export function getETA(fromCurrency: string, toCurrency: string): string {
  if (fromCurrency === toCurrency) return 'Instantly';
  const instant = ['USD', 'EUR', 'GBP', 'MXN'];
  if (instant.includes(fromCurrency) && instant.includes(toCurrency)) return 'Within minutes';
  return 'Within 1–2 hours';
}
