export const DIRECTUS_CRC_ROLE_ID =
  '0234F31D-78EC-4166-BE7F-989132F2B065' as const;

export type DirectusRoleIdentity = {
  id?: string | null;
  name?: string | null;
};

export function normalizeDirectusRoleId(roleId?: string | null): string | null {
  const normalizedRoleId = roleId?.trim().toLowerCase();

  return normalizedRoleId || null;
}

export function isDirectusCrcRole(
  role?: DirectusRoleIdentity | null
): boolean {
  return (
    normalizeDirectusRoleId(role?.id) ===
    normalizeDirectusRoleId(DIRECTUS_CRC_ROLE_ID)
  );
}
