/** Turkish number and money formatting for the preference explorer. */

const integerFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const moneyFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 });

export function formatRank(value: number | null): string {
  return value === null ? 'veri yok' : integerFormat.format(value);
}

export function formatNumber(value: number): string {
  return integerFormat.format(value);
}

/**
 * `null` and `0` mean different things here: `null` is "no published figure",
 * `0` is "a full scholarship covers it". They must never render the same way.
 */
export function formatMoney(value: number | null): string {
  if (value === null) return 'Veri yok';
  if (value === 0) return 'Ücret yok (burslu)';
  return `${moneyFormat.format(value)} TL`;
}

export function formatDecimal(value: number | null): string {
  return value === null ? 'Veri yok' : decimalFormat.format(value);
}

export function formatAdvantage(value: number | null): string {
  if (value === null) return 'Veri yok';
  if (value === 0) return '0 · aynı sıra';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${integerFormat.format(Math.abs(value))} · ${value > 0 ? 'aday önde' : 'aday geride'}`;
}

/** Describes the gap between the candidate rank and a closing rank. */
export function formatRankDistance(distance: number | null): string {
  if (distance === null) return 'Geçmiş veri yok';
  if (distance === 0) return 'Tam kapanış sırasında';
  const amount = integerFormat.format(Math.abs(distance));
  return distance > 0
    ? `${amount} sıra geride` // candidate sits below the closing rank
    : `${amount} sıra önde`;
}
