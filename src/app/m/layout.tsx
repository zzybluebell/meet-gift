import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MobileHeader } from "@/components/mobile/header";
import { Copyright } from "@/components/copyright";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 to-white max-w-md mx-auto border-x flex flex-col">
      <MobileHeader userName={user.name} buildingName={user.buildingName} />
      <div className="flex-1">{children}</div>
      <Copyright />
    </div>
  );
}
