import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { VerifyHeader } from "./header";

export default async function VerifyLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "verifier" && user.role !== "admin") {
    redirect("/m");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white max-w-md mx-auto border-x">
      <VerifyHeader userName={user.name} buildingName={user.buildingName} />
      <div className="pb-8">{children}</div>
    </div>
  );
}
