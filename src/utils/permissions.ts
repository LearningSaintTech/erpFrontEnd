export function hasPermission(permissions: string[], required: string, isSuperAdmin = false): boolean {
  if (isSuperAdmin || permissions.includes('*')) return true;
  return permissions.includes(required);
}

export function hasAnyPermission(permissions: string[], required: string[], isSuperAdmin = false): boolean {
  if (isSuperAdmin || permissions.includes('*')) return true;
  return required.some((p) => permissions.includes(p));
}
