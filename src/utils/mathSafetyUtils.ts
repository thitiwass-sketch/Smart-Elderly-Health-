// Null-Safe Numeric & Statistical Calculations Utility
// Guarantees zero NaN, zero division-by-zero, and robust fallback for healthcare dashboards

export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = typeof value === 'number' ? value : Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export function safeRatio(numerator: unknown, denominator: unknown, fallback = 0): number {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 0);
  if (den === 0) return fallback;
  const result = num / den;
  return isNaN(result) || !isFinite(result) ? fallback : result;
}

export function safePercent(
  numerator: unknown,
  denominator: unknown,
  decimals = 1,
  fallback = 0
): number {
  const ratio = safeRatio(numerator, denominator, fallback / 100);
  const pct = ratio * 100;
  return Number(pct.toFixed(decimals));
}

export function formatSafeNumber(value: unknown, fallback = '0'): string {
  const num = safeNumber(value, NaN);
  if (isNaN(num)) return fallback;
  return num.toLocaleString();
}

export function formatSafePercent(
  valueOrNumerator: unknown,
  denominatorOrDecimals?: unknown,
  decimalsOrFallback: number | string = 1,
  fallback = '0.0%'
): string {
  if (denominatorOrDecimals === undefined || typeof denominatorOrDecimals === 'number') {
    const num = safeNumber(valueOrNumerator, NaN);
    const fallbackStr = typeof decimalsOrFallback === 'string' ? decimalsOrFallback : fallback;
    if (isNaN(num)) return fallbackStr;
    const dec = typeof denominatorOrDecimals === 'number' ? denominatorOrDecimals : 1;
    return `${num.toFixed(dec)}`;
  }
  const num = safeNumber(valueOrNumerator, NaN);
  const den = safeNumber(denominatorOrDecimals, NaN);
  const fallbackStr = typeof fallback === 'string' ? fallback : '0.0%';
  if (isNaN(num) || isNaN(den) || den === 0) return fallbackStr;
  const dec = typeof decimalsOrFallback === 'number' ? decimalsOrFallback : 1;
  const pct = (num / den) * 100;
  return `${pct.toFixed(dec)}`;
}
