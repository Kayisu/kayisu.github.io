import { BODIES } from '../data/planets';
import {
  planetPath,
  sectionPath,
  type CelestialBodyId,
  type Dictionary,
  type Locale,
} from '../i18n';
import type { SolarBody, SolarCopy } from '../components/solar/SolarApp';

function bodyHref(locale: Locale, name: CelestialBodyId): string {
  if (name === 'sun') {
    return locale === 'en' ? '/star/sun/' : sectionPath('tr', 'about');
  }
  return planetPath(locale, name);
}

export function createSolarPresentation(locale: Locale, dictionary: Dictionary): {
  bodies: SolarBody[];
  copy: SolarCopy;
} {
  const bodies = BODIES.map((body) => {
    const name = body.name as CelestialBodyId;
    const presentation = dictionary.solar.bodies[name];

    return {
      ...body,
      label: presentation.name,
      type: presentation.category,
      desc: presentation.description,
      href: bodyHref(locale, name),
    } satisfies SolarBody;
  });

  const { bodies: _bodyCopy, ...copy } = dictionary.solar;
  return { bodies, copy };
}
