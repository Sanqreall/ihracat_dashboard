"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { X, Loader2, Inbox, ChevronDown, ChevronRight } from "lucide-react";
import type { Tone } from "@/lib/constants";
import { parseNumber } from "@/lib/format";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// className bir genişlik veriyorsa varsayılan w-full'u kaldır (çakışma olmasın)
const hasWidth = (c?: string) => !!c && /(^|\s)(w-|col-span-|flex-1|basis-)/.test(c);
const widthed = (base: string, c?: string) => cx(hasWidth(c) ? base.replace(/(^|\s)w-full(?=\s|$)/, " ") : base, c);

type IconT = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

// ---------------------------------------------------------------- Button
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "success";
export function Button({
  variant = "primary", size = "md", icon: Icon, loading, className, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; size?: "xs" | "sm" | "md"; icon?: IconT; loading?: boolean;
}) {
  const v = {
    primary: "bg-navy text-white border-navy hover:bg-ink hover:border-ink",
    secondary: "bg-white text-navy border-line hover:bg-cream",
    ghost: "bg-transparent text-navy border-transparent hover:bg-cream",
    danger: "bg-oxblood text-white border-oxblood hover:bg-[#8a2c30]",
    gold: "bg-gold text-ink border-gold hover:bg-gold-dark",
    success: "bg-forest text-white border-forest hover:bg-[#2f6647]",
  }[variant];
  const s = { xs: "px-2 py-1 text-[11px] gap-1", sm: "px-3 py-1.5 text-xs gap-1.5", md: "px-4 py-2 text-sm gap-2" }[size];
  const is = size === "xs" ? 11 : size === "sm" ? 13 : 15;
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx("inline-flex items-center justify-center rounded-md font-semibold border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap", v, s, className)}
    >
      {loading ? <Loader2 size={is} className="animate-spin" /> : Icon ? <Icon size={is} /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Form alanları
const fieldCls = "w-full px-3 py-2 rounded-md border border-line bg-white text-sm text-ink transition focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 disabled:bg-cream disabled:text-muted placeholder:text-muted/60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} {...rest} className={widthed(fieldCls, className)} />;
  }
);

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...rest} className={widthed(cx(fieldCls, "resize-y min-h-[72px]"), className)} />;
}

// Select — kendi oku olan sade görünüm; className kutunun yerleşimi/genişliği, selectClassName seçicinin kendisi
export function Select({ className, selectClassName, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { selectClassName?: string }) {
  return (
    <div className={cx("relative", hasWidth(className) ? "" : "w-full", className)}>
      <select {...rest} className={cx(fieldCls, "appearance-none cursor-pointer pr-8 truncate", selectClassName)}>
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
    </div>
  );
}

export function Field({ label, hint, required, children, className }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink mb-1">
        {label} {required && <span className="text-oxblood">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted mt-1">{hint}</span>}
    </label>
  );
}

// Sayı girişi — TR biçimini (virgül) kabul eder, boşken 0 yazmaz
export function NumberInput({ value, onChange, className, ...rest }: {
  value: number | null | undefined; onChange: (n: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = React.useState<string>(value == null ? "" : String(value).replace(".", ","));
  const focused = React.useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value).replace(".", ","));
  }, [value]);
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={text}
      onFocus={(e) => { focused.current = true; rest.onFocus?.(e); }}
      onBlur={(e) => { focused.current = false; setText(value == null ? "" : String(value).replace(".", ",")); rest.onBlur?.(e); }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        onChange(parseNumber(t));
      }}
      className={widthed(cx(fieldCls, "text-right tabular-nums"), className)}
    />
  );
}

// ---------------------------------------------------------------- Card / Header
export function Card({ title, subtitle, action, children, className, padded = true }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={cx("bg-white rounded-lg border border-line transition-shadow hover:shadow-sm", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-line">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="bg-white border-b border-line px-4 md:px-8 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="px-4 md:px-8 py-6 pb-12 space-y-5">{children}</div>;
}

// ---------------------------------------------------------------- Badge
const toneHex: Record<Tone, string> = {
  muted: "#7A736A", navy: "#1E3A5F", copper: "#B87333", gold: "#A88947", forest: "#3E7D5A", oxblood: "#A6383D",
};
export function Badge({ tone = "muted", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  const c = toneHex[tone];
  return (
    <span
      className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap", className)}
      style={{ background: c + "18", color: c, border: `1px solid ${c}33` }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[size];
  // Dışarı tıklayınca / ESC ile kapanmaz — yarım kalan formun yanlışlıkla kaybolmaması için
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 md:p-6 overflow-y-auto" style={{ background: "rgba(15,26,46,0.5)", backdropFilter: "blur(4px)" }}>
      <div className={cx("w-full bg-white rounded-lg border border-line shadow-2xl my-6", w)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-cream rounded-t-lg">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:bg-white/60" aria-label="Kapat" title="Kapat"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 py-3 border-t border-line bg-cream/40 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Durumlar
export function Loading({ text = "Yükleniyor…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted text-sm">
      <Loader2 size={18} className="animate-spin" /> {text}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-[#E8C2C4] bg-[#FBEAEB] text-oxblood text-sm px-4 py-3 flex items-center justify-between gap-3">
      <span>{error}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Tekrar dene</Button>}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center mb-2"><Inbox size={18} className="text-gold" /></div>
      <div className="text-sm font-semibold text-ink">{title}</div>
      {hint && <div className="text-xs text-muted mt-1 max-w-md">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- KPI kartı (eski panel tasarımı)
const accentHex = { navy: "#1E3A5F", forest: "#3E7D5A", gold: "#C9A961", oxblood: "#A6383D", copper: "#B87333", muted: "#7A736A" } as const;
export function Stat({ label, value, sub, tone, icon: Icon, accent, href }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "danger" | "ok";
  icon?: IconT; accent?: keyof typeof accentHex; href?: string;
}) {
  const a = accentHex[accent || (tone === "danger" ? "oxblood" : tone === "ok" ? "forest" : "navy")];
  const body = (
    <div className="relative h-full rounded-xl bg-white border border-line p-5 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5" style={{ boxShadow: "0 1px 3px rgba(15,26,46,0.04)" }}>
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${a}, ${a}90)` }} />
      {Icon && <div className="absolute top-3 right-3 opacity-[0.07]" style={{ color: a }}><Icon size={70} strokeWidth={1.5} /></div>}
      <div className="relative">
        <div className="flex items-center gap-2 mb-3 mt-1">
          {Icon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: a + "18" }}>
              <span style={{ color: a }}><Icon size={15} strokeWidth={2.2} /></span>
            </div>
          )}
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted leading-tight">{label}</span>
          {href && <ChevronRight size={12} className="ml-auto text-muted shrink-0" />}
        </div>
        <div className={cx("text-[26px] leading-tight font-bold tabular-nums tracking-tight", tone === "danger" ? "text-oxblood" : "text-ink")}>{value}</div>
        {sub && <div className="text-xs mt-1.5 font-semibold text-muted">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

// ---------------------------------------------------------------- Tablo
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}
export const Th = ({ children, className, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...rest} className={cx("text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-2.5 border-b border-line bg-cream/60 whitespace-nowrap", className)}>{children}</th>
);
export const Td = ({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...rest} className={cx("px-4 py-2.5 border-b border-line/70 align-middle text-ink", className)}>{children}</td>
);

// Sekmeler
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 border-b border-line overflow-x-auto">
      {items.map((it) => (
        <button key={it.key} onClick={() => onChange(it.key)}
          className={cx("px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition", value === it.key ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink")}>
          {it.label}{it.count != null && <span className="ml-1.5 text-[11px] text-muted">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export { cx };
