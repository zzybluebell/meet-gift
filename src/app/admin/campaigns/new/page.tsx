import { prisma } from "@/lib/prisma";
import { NewCampaignForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const [gifts, departments, buildings] = await Promise.all([
    prisma.gift.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.employee.findMany({ distinct: ["department"], select: { department: true } }),
    prisma.building.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-8">
      <NewCampaignForm
        gifts={gifts.map((g) => ({ id: g.id, name: g.name, imageUrl: g.imageUrl, category: g.category }))}
        departments={departments.map((d) => d.department).sort()}
        buildings={buildings.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
