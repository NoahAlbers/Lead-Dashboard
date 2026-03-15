import { getPartners } from "@/actions/partner.actions";
import { getStateClassificationMap } from "@/actions/state-classification.actions";
import { PartnersManager } from "@/components/admin/partners-manager";

export default async function PartnersPage() {
  const [partners, stateClassifications] = await Promise.all([
    getPartners(),
    getStateClassificationMap(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Partners</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage external agencies and referral partners
        </p>
      </div>
      <PartnersManager
        initialPartners={partners.map((p) => ({
          ...p,
          minimumClaimSize: p.minimumClaimSize ? Number(p.minimumClaimSize) : null,
          maximumClaimSize: p.maximumClaimSize ? Number(p.maximumClaimSize) : null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }))}
        stateClassifications={stateClassifications}
      />
    </div>
  );
}
