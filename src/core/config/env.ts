const directusUrl = process.env.EXPO_PUBLIC_DIRECTUS_URL?.trim();
const aiBackendUrl = process.env.EXPO_PUBLIC_AI_BACKEND_URL?.trim();

if (!directusUrl) {
  throw new Error(
    'EXPO_PUBLIC_DIRECTUS_URL is required. Add EXPO_PUBLIC_DIRECTUS_URL=http://localhost:8055 to your .env file.'
  );
}

if (!aiBackendUrl) {
  throw new Error(
    'EXPO_PUBLIC_AI_BACKEND_URL is required. Add EXPO_PUBLIC_AI_BACKEND_URL=http://localhost:3001 to your .env file.'
  );
}

function validateHttpUrl(value: string, variableName: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid HTTP or HTTPS URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${variableName} must be a valid HTTP or HTTPS URL.`);
  }

  return value.replace(/\/+$/, '');
}

export const env = {
  directusUrl: directusUrl.replace(/\/+$/, ''),
  aiBackendUrl: validateHttpUrl(
    aiBackendUrl,
    'EXPO_PUBLIC_AI_BACKEND_URL'
  ),
} as const;
