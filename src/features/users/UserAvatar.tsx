export function UserAvatar({
  user,
  size = 'sm',
}: {
  user: { firstName: string; lastName: string; email?: string };
  size?: 'sm' | 'md';
}) {
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    || user.email?.[0]?.toUpperCase()
    || '?';
  const sizeClass = size === 'md' ? 'h-8 w-8 text-[13px]' : 'h-6 w-6 text-xs';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--erp-accent-subtle)] font-semibold text-[var(--erp-accent)] ${sizeClass}`}
      aria-hidden
    >
      {initials}
    </span>
  );
}
