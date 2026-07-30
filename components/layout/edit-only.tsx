'use client';

import { usePermission } from '@/components/layout/permission-provider';

/**
 * Yalnızca düzenleme yetkisi olan kullanıcılara gösterilen sarmalayıcı.
 * Görüntüleme yetkili kullanıcılar için çocukları render etmez.
 *
 * Not: Bu yalnızca arayüzü sadeleştirir; asıl güvenlik server action'lardaki
 * requireEdit/requireAdmin kontrolleridir.
 */
export function EditOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canEdit } = usePermission();
  if (!canEdit) return <>{fallback}</>;
  return <>{children}</>;
}

/** Yalnızca yöneticiye gösterilen sarmalayıcı. */
export function AdminOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { isAdmin } = usePermission();
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
