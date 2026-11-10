"use client";
import { Card, ErrorBox, Loading, Page, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { useAuth, useToast } from "@/components/providers";
import { useData, q } from "@/lib/hooks";
import { supabase } from "@/lib/supabase/client";
import { ROLES } from "@/lib/constants";
import { errMsg, fmtDate } from "@/lib/format";
import type { Profile, Role } from "@/lib/types";

export default function UsersPage() {
  const { isAdmin, profile: me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useData(() => q<Profile[]>(supabase().from("profiles").select("*").order("created_at")));

  if (!isAdmin) return <Page><ErrorBox error="Bu sayfa sadece yöneticiler içindir." /></Page>;

  const setRole = async (p: Profile, role: Role) => {
    if (p.id === me.id && role !== "admin" && !confirm("Kendi yönetici yetkini kaldırıyorsun. Emin misin?")) return;
    const { error } = await supabase().from("profiles").update({ role }).eq("id", p.id);
    if (error) return toast(errMsg(error), "error");
    toast("Rol güncellendi", "success");
    reload();
  };

  return (
    <>
      <PageHeader title="Kullanıcılar" subtitle="Rol yetkisi veritabanında uygulanır — görüntüleyici hiçbir kaydı değiştiremez." />
      <Page>
        <Card>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted">
            <li>Yeni kullanıcı: Supabase → <b>Authentication → Users → Add user</b> (e-posta + şifre, "Auto Confirm" işaretli).</li>
            <li>Kullanıcı burada <b>Onay bekliyor</b> olarak belirir (hiçbir veriyi göremez); rolünü buradan ver.</li>
            <li>Kullanıcıyı tamamen kaldırmak için Supabase → Authentication → Users → sil.</li>
          </ol>
        </Card>
        {error && <ErrorBox error={error} onRetry={reload} />}
        <Card padded={false}>
          {loading ? <Loading /> : (
            <Table>
              <thead><tr><Th>Ad</Th><Th>E-posta</Th><Th>Rol</Th><Th>Eklenme</Th></tr></thead>
              <tbody>
                {(data || []).map((p) => (
                  <tr key={p.id}>
                    <Td className="font-semibold">{p.full_name}</Td>
                    <Td>{p.email}</Td>
                    <Td className="w-56">
                      <Select value={p.role} onChange={(e) => setRole(p, e.target.value as Role)}>
                        {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label} — {r.desc}</option>)}
                      </Select>
                    </Td>
                    <Td>{fmtDate(p.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
    </>
  );
}
