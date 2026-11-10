import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AuthProvider } from "@/components/providers";
import { Sidebar } from "@/components/Sidebar";
import type { Profile } from "@/lib/types";
import { SignOutButton } from "./sign-out";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg bg-white border border-line rounded-lg p-6">
          <h1 className="text-lg font-bold mb-2">Kurulum eksik</h1>
          <p className="text-sm text-muted">
            Vercel → Project → Settings → Environment Variables bölümüne
            <b> NEXT_PUBLIC_SUPABASE_URL</b> ve <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> ekleyip yeniden deploy et.
          </p>
        </div>
      </div>
    );
  }

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg bg-white border border-line rounded-lg p-6 space-y-3">
          <h1 className="text-lg font-bold">Hesap profili bulunamadı</h1>
          <p className="text-sm text-muted">
            Giriş yaptın ama bu kullanıcının profili yok. Veritabanı kurulum dosyası (kurulum.sql) çalıştırılmamış olabilir.
            Kurulumu yaptıktan sonra çıkış yapıp tekrar gir.
          </p>
          <SignOutButton />
        </div>
      </div>
    );
  }

  if (profile.role === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg bg-white border border-line rounded-lg p-6 space-y-3">
          <h1 className="text-lg font-bold">Hesabın onay bekliyor</h1>
          <p className="text-sm text-muted">
            Giriş yaptın ({profile.email}) ama henüz yetki verilmedi. Yöneticiden Kullanıcılar ekranında sana rol vermesini iste,
            sonra çıkış yapıp tekrar gir.
          </p>
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <AuthProvider profile={profile as Profile}>
      <div className="min-h-screen md:flex">
        <Sidebar />
        <main className="flex-1 min-w-0 pt-12 md:pt-0">{children}</main>
      </div>
    </AuthProvider>
  );
}
