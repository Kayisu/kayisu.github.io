/** Turkish number and money formatting for the preference explorer. */

const integerFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const moneyFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

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
  if (value === null) return 'belirtilmemiş';
  if (value === 0) return 'Ücret yok (burslu)';
  return `${moneyFormat.format(value)} TL`;
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
