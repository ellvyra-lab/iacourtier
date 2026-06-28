import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar />
        <DashboardMobileNav />
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
