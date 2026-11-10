"use client";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import type { Profile } from "@/lib/types";

// ---------------------------------------------------------------- Oturum / rol
interface AuthCtx {
  profile: Profile;
  canEdit: boolean;
  isAdmin: boolean;
}
const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const value: AuthCtx = {
    profile,
    canEdit: profile.role === "admin" || profile.role === "editor",
    isAdmin: profile.role === "admin",
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(AuthContext);
  if (!c) throw new Error("AuthProvider eksik");
  return c;
}

// ---------------------------------------------------------------- Bildirim
type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; msg: string; kind: ToastKind }
const ToastContext = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const show = useCallback((msg: string, kind: ToastKind = "info") => {
    const id = ++seq.current;
    setItems((a) => [...a, { id, msg, kind }]);
    setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), kind === "error" ? 8000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed z-[70] bottom-4 right-4 flex flex-col gap-2 max-w-sm">
        {items.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
          const cls = t.kind === "success" ? "border-[#BFE0CC] text-forest" : t.kind === "error" ? "border-[#E8C2C4] text-oxblood" : "border-line text-ink";
          return (
            <div key={t.id} className={`flex items-start gap-2 bg-white border rounded-md shadow-lg px-3 py-2.5 text-sm ${cls}`}>
              <Icon size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{t.msg}</span>
              <button onClick={() => setItems((a) => a.filter((x) => x.id !== t.id))} className="opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
