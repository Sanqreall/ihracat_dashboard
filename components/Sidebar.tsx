"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Package, FileText, Wallet, Landmark, Coins, LogOut, ShieldCheck, Database, Menu, X,
  PanelLeftClose, Pin,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./providers";
import { ROLES, labelOf } from "@/lib/constants";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };
const SECTIONS: { title: string; admin?: boolean; items: Item[] }[] = [
  { title: "Gösterge", items: [{ href: "/", label: "Panel", icon: LayoutDashboard }] },
  {
    title: "Operasyon",
    items: [
      { href: "/siparisler", label: "Siparişler", icon: FileText },
      { href: "/tahsilatlar", label: "Tahsilatlar", icon: Wallet },
    ],
  },
  {
    title: "Kayıtlar",
    items: [
      { href: "/musteriler", label: "Müşteriler", icon: Users },
      { href: "/urunler", label: "Ürünler", icon: Package },
      { href: "/bankalar", label: "Banka Hesapları", icon: Landmark },
      { href: "/kurlar", label: "Döviz Kurları", icon: Coins },
    ],
  },
  {
    title: "Yönetim",
    admin: true,
    items: [
      { href: "/kullanicilar", label: "Kullanıcılar", icon: ShieldCheck },
      { href: "/aktarim", label: "Veri Aktarımı", icon: Database },
    ],
  },
];

const W_OPEN = 248;
const W_RAIL = 68;
const KEY = "sb_pinned";

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { profile, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [hover, setHover] = useState(false);

  // Tercihi hatırla (sabit / daraltılmış)
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v === "0") setPinned(false); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, pinned ? "1" : "0"); } catch {}
    document.documentElement.style.setProperty("--sb-w", `${pinned ? W_OPEN : W_RAIL}px`);
  }, [pinned]);

  const expanded = pinned || hover;

  const logout = async () => {
    await supabase().auth.signOut();
    router.replace("/giris");
    router.refresh();
  };

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const initials = (profile.full_name || profile.email || "?").trim().slice(0, 1).toUpperCase();

  const content = (wide: boolean, onNav?: () => void) => (
    <>
      {/* LOGO */}
      <div className="px-4 py-5 border-b border-white/[0.06] flex items-start justify-between gap-2 min-h-[92px]">
        <div className="min-w-0">
          <div className={wide ? "" : "w-9 overflow-hidden"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="Yonga" className="h-8 w-auto max-w-none" />
          </div>
          {wide && (
            <div className="mt-2 whitespace-nowrap">
              <div className="font-semibold text-white text-[13px] tracking-wider">İHRACAT OPERASYONLARI</div>
              <div className="text-[10px] uppercase tracking-widest text-gold">Yönetim Sistemi</div>
            </div>
          )}
        </div>
      </div>

      {/* MENÜ */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {SECTIONS.filter((s) => !s.admin || isAdmin).map((sec) => (
          <div key={sec.title} className="mb-3">
            <div className={`px-5 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-slate-500 whitespace-nowrap transition-opacity ${wide ? "opacity-100" : "opacity-0 h-0 py-0 overflow-hidden"}`}>
              {sec.title}
            </div>
            {!wide && <div className="mx-4 my-1 border-t border-white/[0.06]" />}
            {sec.items.map((n) => {
              const Icon = n.icon;
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  title={wide ? undefined : n.label}
                  onClick={onNav}
                  className={`relative flex items-center gap-3 py-2.5 text-[13px] transition whitespace-nowrap ${wide ? "px-5" : "px-0 justify-center"} ${
                    active ? "bg-white/[0.08] text-white" : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />}
                  <Icon size={wide ? 15 : 18} className={active ? "text-gold" : "text-slate-400"} />
                  {wide && <span>{n.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* KULLANICI */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className={`rounded-md bg-white/[0.06] ${wide ? "p-2.5" : "p-1.5"}`}>
          <div className={`flex items-center gap-2 ${wide ? "" : "justify-center"}`}>
            <div className="w-7 h-7 rounded-full bg-gold text-ink flex items-center justify-center text-xs font-bold shrink-0" title={wide ? undefined : profile.full_name || profile.email || ""}>{initials}</div>
            {wide && (
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white truncate">{profile.full_name || profile.email}</div>
                <div className="text-[10px] text-slate-400">{labelOf(ROLES, profile.role)}</div>
              </div>
            )}
          </div>
          <button onClick={logout} title="Çıkış yap"
            className={`mt-2 w-full flex items-center gap-2 rounded px-2 py-1 text-[12px] text-slate-300 hover:text-white hover:bg-white/[0.06] ${wide ? "" : "justify-center"}`}>
            <LogOut size={13} /> {wide && "Çıkış yap"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* MOBİL: üst düğme + çekmece */}
      <button className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-md bg-ink text-white shadow-lg" onClick={() => setMobileOpen(true)} aria-label="Menü">
        <Menu size={18} />
      </button>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 h-full flex flex-col bg-ink text-slate-300 shadow-2xl" style={{ width: W_OPEN }}>
            <button className="absolute top-4 right-3 text-slate-400 hover:text-white z-10" onClick={() => setMobileOpen(false)}><X size={18} /></button>
            {content(true, () => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* MASAÜSTÜ: yer tutucu + sabit/daraltılabilir menü */}
      <div className="hidden md:block shrink-0 transition-[width] duration-200" style={{ width: pinned ? W_OPEN : W_RAIL }} />
      <aside
        className="hidden md:flex fixed top-0 left-0 z-40 h-screen flex-col bg-ink text-slate-300 transition-[width] duration-200 overflow-hidden"
        style={{ width: expanded ? W_OPEN : W_RAIL, boxShadow: !pinned && hover ? "8px 0 24px rgba(15,26,46,0.25)" : undefined }}
        onMouseEnter={() => !pinned && setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {content(expanded)}
        {/* Sabitle / daralt düğmesi */}
        {expanded && (
          <button
            onClick={() => { setPinned((p) => !p); setHover(false); }}
            title={pinned ? "Menüyü daralt" : "Menüyü sabitle"}
            className="absolute top-5 right-3 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            {pinned ? <PanelLeftClose size={16} /> : <Pin size={15} />}
          </button>
        )}
      </aside>
    </>
  );
}
