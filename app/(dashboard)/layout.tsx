import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { PermissionProvider } from '@/components/layout/permission-provider';
import { createClient } from '@/lib/supabase/server';
import { getPermission } from '@/lib/auth/permissions';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const perm = await getPermission();

  return (
    <PermissionProvider value={{ role: perm.role, isAdmin: perm.isAdmin, canEdit: perm.canEdit }}>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Topbar userEmail={user?.email} />
          {!perm.canEdit && perm.role && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-xs text-amber-700 dark:text-amber-400">
              Görüntüleme yetkisiyle oturum açtınız. Kayıt ekleme/düzenleme yapamazsınız; yetki için yöneticinizle görüşün.
            </div>
          )}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </PermissionProvider>
  );
}
