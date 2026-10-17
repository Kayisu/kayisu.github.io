export type UnavailableReason = '404' | 'wip' | 'unreachable';

export function sandstructionHref(reason: UnavailableReason, from = '', locale: 'en' | 'tr' = 'en'): string {
  const params = new URLSearchParams({ reason, lang: locale });
  if (from.startsWith('/') && !from.startsWith('//')) params.set('from', from);
  return `/sandstruction/?${params}`;
}
