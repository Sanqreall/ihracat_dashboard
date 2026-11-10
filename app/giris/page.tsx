"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setErr(error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı" : error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-navy-dark">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-lg shadow-xl p-6 space-y-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-gold-dark">Yonga</div>
          <h1 className="text-xl font-bold text-ink">İhracat Yönetimi</h1>
          <p className="text-sm text-muted">Devam etmek için giriş yap.</p>
        </div>
        <Field label="E-posta">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Şifre">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {err && <div className="text-sm text-oxblood">{err}</div>}
        <Button type="submit" className="w-full" loading={busy}>Giriş yap</Button>
      </form>
    </div>
  );
}
