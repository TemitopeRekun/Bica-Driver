/**
 * Currency & Financial Display Utilities
 * Enterprise-grade null-safe formatting for money values
 */

/**
 * Format currency with safe null handling
 * Prevents NaN and "undefined" in the UI
 */
export const formatCurrencyAmount = (amount: number | null | undefined, defaultValue = '₦0'): string => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return defaultValue;
  }
  return `₦${amount.toLocaleString()}`;
};

/**
 * Extract driver earnings with fallback
 * Handles multiple possible fields: driverEarnings, amount, fare
 */
export const getDriverEarningsDisplay = (
  driverEarnings?: number | null,
  fallbackAmount?: number | null,
  fallbackFare?: number | null
): string => {
  const amount = driverEarnings ?? fallbackAmount ?? fallbackFare;
  return formatCurrencyAmount(amount);
};

/**
 * Extract price for ride request card
 * Prioritizes driverEarnings, then amount
 */
export const getRideRequestPrice = (
  driverEarnings?: number | null,
  amount?: number | null
): string => {
  const price = driverEarnings ?? amount;
  return formatCurrencyAmount(price, '—');
};

/**
 * Validate and format numeric amount
 */
export const validateAmount = (value: any): number | null => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
};
