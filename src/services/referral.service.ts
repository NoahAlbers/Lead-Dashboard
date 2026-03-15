import { prisma } from "@/lib/db";
import type { Lead, ReferralPartner } from "@prisma/client";

interface ReferralRecommendation {
  partner: ReferralPartner;
  reason: string;
  score: number;
}

export async function evaluateReferral(
  lead: Lead
): Promise<ReferralRecommendation[]> {
  const partners = await prisma.referralPartner.findMany({
    where: { active: true },
    orderBy: { rankingPriority: "asc" },
  });

  const recommendations: ReferralRecommendation[] = [];

  for (const partner of partners) {
    let matchScore = 0;
    const reasons: string[] = [];

    // Check state coverage
    const statesServed = partner.statesServedJson as string[] | null;
    if (statesServed && lead.state) {
      if (
        statesServed
          .map((s) => s.toLowerCase())
          .includes(lead.state.toLowerCase())
      ) {
        matchScore += 30;
        reasons.push(`Serves ${lead.state}`);
      }
    }

    // Check industry match
    const industries = partner.industriesServedJson as string[] | null;
    if (industries && lead.industry) {
      if (
        industries
          .map((i) => i.toLowerCase())
          .includes(lead.industry.toLowerCase())
      ) {
        matchScore += 20;
        reasons.push(`Handles ${lead.industry} industry`);
      }
    }

    // Check lead type match
    const preferredTypes = partner.preferredLeadTypesJson as string[] | null;
    if (preferredTypes && lead.debtType) {
      if (
        preferredTypes
          .map((t) => t.toLowerCase())
          .includes(lead.debtType.toLowerCase())
      ) {
        matchScore += 20;
        reasons.push(`Accepts ${lead.debtType} debt type`);
      }
    }

    // Check claim size range
    const balance = lead.balanceAmount ? Number(lead.balanceAmount) : null;
    if (balance !== null) {
      const min = partner.minimumClaimSize
        ? Number(partner.minimumClaimSize)
        : 0;
      const max = partner.maximumClaimSize
        ? Number(partner.maximumClaimSize)
        : Infinity;
      if (balance >= min && balance <= max) {
        matchScore += 15;
        reasons.push("Balance within accepted range");
      }
    }

    // Check exclusions
    const exclusions = partner.exclusionsJson as string[] | null;
    if (exclusions) {
      const excluded = exclusions.some((ex) => {
        const exLower = ex.toLowerCase();
        return (
          lead.state?.toLowerCase() === exLower ||
          lead.industry?.toLowerCase() === exLower ||
          lead.debtType?.toLowerCase() === exLower
        );
      });
      if (excluded) continue; // Skip excluded partners
    }

    if (matchScore > 0) {
      recommendations.push({
        partner,
        reason: reasons.join("; "),
        score: matchScore,
      });
    }
  }

  // Sort by score descending, then by ranking priority
  return recommendations.sort((a, b) => b.score - a.score);
}

export async function getTopReferral(lead: Lead) {
  const recommendations = await evaluateReferral(lead);
  return recommendations.length > 0 ? recommendations[0] : null;
}
