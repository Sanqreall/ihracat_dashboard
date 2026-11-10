"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Basit veri çekme kancası: yükleniyor/hata/veri + pencere odaklanınca yenileme.
// Böylece başka biri değişiklik yaptıysa sekmeye dönünce güncel veri gelir.
export function useData<T>(fn: () => Promise<T>, deps: unknown[] = [], opts: { refetchOnFocus?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const load = useCallback(async (silent = false) => {
    const my = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const v = await fnRef.current();
      if (my === seq.current) {
        setData(v);
        setError(null);
      }
    } catch (e: unknown) {
      if (my === seq.current) setError((e as Error)?.message || String(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (opts.refetchOnFocus === false) return;
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load, opts.refetchOnFocus]);

  return { data, error, loading, reload: () => load(true), setData };
}

// Supabase sorgusunu çalıştır, hata varsa fırlat
export async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? ([] as unknown)) as T;
}

// 1000 satır sınırına takılmadan tüm satırları sayfalayarak çek
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
