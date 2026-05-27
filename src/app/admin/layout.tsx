import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") {
    if (user.role === "verifier") redirect("/verify");
    redirect("/m");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userName={user.name} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
