"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { cx } from "./ui";

// Aramalı açılır liste — müşteri, ürün, sipariş seçimi için.
// Liste sayfanın üstüne (portal) açılır: tablo/kart içinde kesilmez, ekrana sığmazsa yukarı açılır.
export function SearchPicker<T>({
  items, value, onChange, getKey, getLabel, getSub, placeholder = "Seç…", disabled, className, renderValue,
}: {
  items: T[];
  value: string | null | undefined;
  onChange: (key: string, item: T) => void;
  getKey: (t: T) => string;
  getLabel: (t: T) => string;
  getSub?: (t: T) => string | null | undefined;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  renderValue?: (t: T | undefined) => string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => items.find((i) => getKey(i) === value), [items, value, getKey]);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(Math.max(b.width, 300), vw - 16);
    const left = Math.min(Math.max(8, b.left), vw - width - 8);
    const below = vh - b.bottom - 8, above = b.top - 8;
    const up = below < 280 && above > below;
    const maxH = Math.max(160, Math.min(380, (up ? above : below) - 8));
    setPos({ left, width, up, maxH, top: up ? b.top - 4 : b.bottom + 4 });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const filtered = useMemo(() => {
    const s = text.trim().toLocaleLowerCase("tr");
    const list = s ? items.filter((i) => (getLabel(i) + " " + (getSub?.(i) || "")).toLocaleLowerCase("tr").includes(s)) : items;
    return list.slice(0, 100);
  }, [items, text, getLabel, getSub]);

  return (
    <div className={cx("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setText(""); }}
        className="w-full px-3 py-2 rounded-md border border-line bg-white text-sm text-left flex items-center justify-between gap-2 transition focus:outline-none focus:border-navy disabled:bg-cream disabled:text-muted"
      >
        <span className={cx("truncate", !selected && !renderValue && "text-muted")}>
          {renderValue ? renderValue(selected) : selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          className="fixed z-[80] bg-white border border-line rounded-lg shadow-2xl flex flex-col"
          style={{ left: pos.left, width: pos.width, maxHeight: pos.maxH, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
        >
          <div className="relative p-2 border-b border-line shrink-0">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ara…"
              onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) { onChange(getKey(filtered[0]), filtered[0]); setOpen(false); } }}
              className="w-full py-1.5 pl-7 pr-2 rounded border border-line text-sm focus:outline-none focus:border-navy" />
          </div>
          <ul className="overflow-y-auto py-1 min-h-0">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">Sonuç yok</li>}
            {filtered.map((i) => (
              <li key={getKey(i)}>
                <button type="button" onClick={() => { onChange(getKey(i), i); setOpen(false); }}
                  className={cx("w-full text-left px-3 py-1.5 text-sm hover:bg-cream", getKey(i) === value && "bg-cream font-semibold")}>
                  <div className="truncate">{getLabel(i)}</div>
                  {getSub && getSub(i) && <div className="text-[11px] text-muted truncate">{getSub(i)}</div>}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
