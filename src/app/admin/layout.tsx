import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/connexion?next=%2Fadmin&error=auth_configuration");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion?next=%2Fadmin");
  }

  // app_metadata is controlled by Supabase Auth/server administrators. Unlike
  // user_metadata, it cannot be self-assigned from the browser signup form.
  if (user.app_metadata?.role !== "super_admin") {
    redirect("/tableau-de-bord?error=admin_forbidden");
  }

  return <>{children}</>;
}

