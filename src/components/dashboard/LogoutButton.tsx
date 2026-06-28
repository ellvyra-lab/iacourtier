"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={
        className ??
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-[var(--bg)] hover:text-[var(--fg)]"
      }
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
      Se déconnecter
    </button>
  );
}
