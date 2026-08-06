export type DirectusIdRelation =
  | number
  | { id?: number | null }
  | null
  | undefined;

export function getDirectusRelationId(
  relation: DirectusIdRelation
): number | null {
  const id = typeof relation === 'number' ? relation : relation?.id;

  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}
