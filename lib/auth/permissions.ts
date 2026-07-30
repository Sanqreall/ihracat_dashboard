'use server';

import { createClient } from '@/lib/supabase/server';

export type Permission = {
  userId: string | null;
  role: 'admin' | 'manager' | 'employee' | null;
  isAdmin: boolean;
  canEdit: boolean; // düzenleme yetkisi (admin veya can_edit=true)
};

/** Oturumdaki kullanıcının yetkisini getirir. */
export async function getPermission(): Promise<Permission> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, role: null, isAdmin: false, canEdit: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, can_edit')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile?.role as Permission['role']) ?? 'employee';
  const isAdmin = role === 'admin';
  const canEdit = isAdmin || Boolean(profile?.can_edit);
  return { userId: user.id, role, isAdmin, canEdit };
}

/**
 * Düzenleme yetkisi ister; yoksa hata fırlatır. Yazma (ekle/güncelle/sil)
 * yapan server action'ların başında çağrılır.
 */
export async function requireEdit(): Promise<Permission> {
  const perm = await getPermission();
  if (!perm.canEdit) {
    throw new Error('Bu işlem için düzenleme yetkiniz yok. Lütfen yöneticinizle görüşün.');
  }
  return perm;
}

/**
 * Yönetici yetkisi ister; yoksa hata fırlatır. Veri sıfırlama ve kullanıcı
 * yetkilerini değiştirme gibi işlemler için.
 */
export async function requireAdmin(): Promise<Permission> {
  const perm = await getPermission();
  if (!perm.isAdmin) {
    throw new Error('Bu işlem yalnızca yöneticiler tarafından yapılabilir.');
  }
  return perm;
}
