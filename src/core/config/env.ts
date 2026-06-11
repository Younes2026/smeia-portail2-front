const directusUrl = process.env.EXPO_PUBLIC_DIRECTUS_URL?.trim();

if (!directusUrl) {
  throw new Error(
    'EXPO_PUBLIC_DIRECTUS_URL is required. Add EXPO_PUBLIC_DIRECTUS_URL=http://localhost:8055 to your .env file.'
  );
}

export const env = {
  directusUrl: directusUrl.replace(/\/+$/, ''),
} as const;
