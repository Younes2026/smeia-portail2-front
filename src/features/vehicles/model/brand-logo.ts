export const BRAND_LOGOS = {
  bmw: {
    name: 'BMW',
    source: require('@/assets/logos/bmw.png'),
  },
  mini: {
    name: 'MINI',
    source: require('@/assets/logos/mini.png'),
  },
  jaguar: {
    name: 'Jaguar',
    source: require('@/assets/logos/jaguar.png'),
  },
  landRover: {
    name: 'Land Rover',
    source: require('@/assets/logos/land-rover.png'),
  },
  mazda: {
    name: 'Mazda',
    source: require('@/assets/logos/mazda.png'),
  },
  jetour: {
    name: 'Jetour',
    needsLightSurface: true,
    source: require('@/assets/logos/Jetour.png'),
  },
} as const;

export function getBrandLogo(brandName?: string | null) {
  const normalizedBrand =
    brandName
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr-FR')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ') ?? '';

  if (normalizedBrand.includes('land rover')) {
    return BRAND_LOGOS.landRover;
  }

  if (normalizedBrand.includes('bmw')) {
    return BRAND_LOGOS.bmw;
  }

  if (normalizedBrand.includes('mini')) {
    return BRAND_LOGOS.mini;
  }

  if (normalizedBrand.includes('jaguar')) {
    return BRAND_LOGOS.jaguar;
  }

  if (normalizedBrand.includes('mazda')) {
    return BRAND_LOGOS.mazda;
  }

  if (normalizedBrand.includes('jetour')) {
    return BRAND_LOGOS.jetour;
  }

  return null;
}
