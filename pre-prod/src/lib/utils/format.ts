const DEFAULT_CURRENCY = 'GBP';

interface FormatCurrencyOptions {
  compact?: boolean;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(value: number, options: FormatCurrencyOptions = {}): string {
  const {
    compact = false,
    currency = DEFAULT_CURRENCY,
    minimumFractionDigits = compact ? 1 : 2,
    maximumFractionDigits = compact ? 1 : 2
  } = options;

  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits,
    maximumFractionDigits
  });

  return formatter.format(value);
}
