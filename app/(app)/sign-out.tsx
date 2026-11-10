"use client";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={async () => { await supabase().auth.signOut(); router.replace("/giris"); router.refresh(); }}>
      Çıkış yap
    </Button>
  );
}
