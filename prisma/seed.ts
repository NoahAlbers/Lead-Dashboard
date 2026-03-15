import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Seed admin user
  const admin = await prisma.user.upsert({
    where: { email: "advancedcollectionbureau@gmail.com" },
    update: {},
    create: {
      name: "Admin",
      email: "advancedcollectionbureau@gmail.com",
      passwordHash: hashSync("admin123", 12),
      role: "ADMIN",
    },
  });
  console.log("Seeded admin user:", admin.email);

  // Seed sample intake user
  const intake = await prisma.user.upsert({
    where: { email: "intake@advancedcb.com" },
    update: {},
    create: {
      name: "Jane Doe",
      email: "intake@advancedcb.com",
      passwordHash: hashSync("intake123", 12),
      role: "INTAKE",
    },
  });
  console.log("Seeded intake user:", intake.email);

  // Seed default scoring rules
  const rules = [
    {
      name: "Florida Target Market",
      description: "Lead is in Florida — ACB primary market",
      priority: 10,
      conditionsJson: [
        { field: "state", operator: "equals", value: "FL" },
      ],
      outcomesJson: { scoreAdjustment: 15, reason: "Florida target market" },
    },
    {
      name: "Commercial Collections",
      description: "Service requested is commercial collections",
      priority: 20,
      conditionsJson: [
        { field: "serviceRequested", operator: "contains", value: "commercial" },
      ],
      outcomesJson: {
        scoreAdjustment: 20,
        reason: "Commercial collections requested",
      },
    },
    {
      name: "High Balance",
      description: "Estimated balance or claim value above $10,000",
      priority: 30,
      conditionsJson: [
        { field: "balanceAmount", operator: "greater_than", value: 10000 },
      ],
      outcomesJson: {
        scoreAdjustment: 20,
        reason: "High balance (>$10,000)",
      },
    },
    {
      name: "Complete Contact Info",
      description: "Lead has both email and phone",
      priority: 40,
      conditionsJson: [
        { field: "email", operator: "is_not_empty", value: "" },
        { field: "phone", operator: "is_not_empty", value: "" },
      ],
      outcomesJson: {
        scoreAdjustment: 10,
        reason: "Complete contact info provided",
      },
    },
    {
      name: "Consumer Debt Penalty",
      description: "Consumer debt type is outside ACB focus",
      priority: 50,
      conditionsJson: [
        { field: "debtType", operator: "contains", value: "consumer" },
      ],
      outcomesJson: {
        scoreAdjustment: -25,
        reason: "Consumer debt — outside core focus",
      },
    },
    {
      name: "Outside Target Geography",
      description: "Lead is not in a preferred state",
      priority: 60,
      conditionsJson: [
        {
          field: "state",
          operator: "not_in",
          value: ["FL", "GA", "AL", "SC", "NC", "TN", "TX", "NY", "CA"],
        },
      ],
      outcomesJson: {
        scoreAdjustment: -20,
        reason: "Outside target geography",
      },
    },
    {
      name: "Missing Contact Info",
      description: "Missing both email and phone — hard stop",
      priority: 5,
      conditionsJson: [
        { field: "email", operator: "is_empty", value: "" },
        { field: "phone", operator: "is_empty", value: "" },
      ],
      outcomesJson: {
        scoreAdjustment: -100,
        reason: "Missing all contact methods",
        hardStop: true,
        action: "disqualify",
      },
    },
    {
      name: "Small Claim Penalty",
      description: "Balance under $1,000",
      priority: 70,
      conditionsJson: [
        { field: "balanceAmount", operator: "less_than", value: 1000 },
        { field: "balanceAmount", operator: "greater_than", value: 0 },
      ],
      outcomesJson: {
        scoreAdjustment: -20,
        reason: "Very small claim size (<$1,000)",
      },
    },
  ];

  for (const rule of rules) {
    await prisma.scoringRule.upsert({
      where: { id: rule.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: rule,
    });
  }
  console.log("Seeded", rules.length, "scoring rules");

  // Seed default email templates
  const templates = [
    {
      name: "Intro Email",
      type: "intro",
      subjectTemplate:
        "Introduction from Advanced Collection Bureau regarding {{company_name}}",
      bodyTemplate: `Hi {{full_name}},

Thank you for reaching out to Advanced Collection Bureau. We reviewed your inquiry and would love to learn more about your needs.

Please reply to this email or call us at (555) 123-4567.

Best,
{{assigned_user_name}}`,
    },
    {
      name: "Referral Email",
      type: "referral",
      subjectTemplate: "Referral Introduction for {{company_name}}",
      bodyTemplate: `Hi {{referral_partner_name}},

We received an inquiry from {{full_name}} at {{company_name}} that appears to be a better fit for your organization based on geography and/or service type.

Their contact details are below:
Email: {{email}}
Phone: {{phone}}
State: {{state}}
Notes: {{notes_from_form}}

Best,
{{assigned_user_name}}`,
    },
    {
      name: "Follow-Up Email",
      type: "follow_up",
      subjectTemplate: "Following Up — Advanced Collection Bureau",
      bodyTemplate: `Hi {{full_name}},

I wanted to follow up on our previous conversation regarding your collection needs at {{company_name}}.

Do you have a few minutes to discuss how we can help? Please feel free to reply or call us at your convenience.

Best,
{{assigned_user_name}}`,
    },
  ];

  for (const tmpl of templates) {
    await prisma.emailTemplate.upsert({
      where: { id: tmpl.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: tmpl,
    });
  }
  console.log("Seeded", templates.length, "email templates");

  // Seed default saved views
  const views = [
    {
      name: "New Today",
      isSystem: true,
      filtersJson: { status: ["NEW"], dateRange: "today" },
      sortJson: { field: "createdAt", direction: "desc" },
    },
    {
      name: "New This Week",
      isSystem: true,
      filtersJson: { status: ["NEW"], dateRange: "this_week" },
      sortJson: { field: "createdAt", direction: "desc" },
    },
    {
      name: "Uncontacted",
      isSystem: true,
      filtersJson: { status: ["NEW", "REVIEWED"] },
      sortJson: { field: "score", direction: "desc" },
    },
    {
      name: "High Score Leads",
      isSystem: true,
      filtersJson: { qualityTier: ["A"] },
      sortJson: { field: "score", direction: "desc" },
    },
    {
      name: "Referral Candidates",
      isSystem: true,
      filtersJson: { qualityTier: ["POOR"], hasReferral: true },
      sortJson: { field: "createdAt", direction: "desc" },
    },
    {
      name: "Duplicates",
      isSystem: true,
      filtersJson: { status: ["DUPLICATE"] },
      sortJson: { field: "createdAt", direction: "desc" },
    },
    {
      name: "Follow-Up Needed",
      isSystem: true,
      filtersJson: { status: ["FOLLOW_UP_NEEDED"] },
      sortJson: { field: "lastActivityAt", direction: "asc" },
    },
    {
      name: "Imported to CRM",
      isSystem: true,
      filtersJson: { status: ["IMPORTED_TO_CRM"] },
      sortJson: { field: "updatedAt", direction: "desc" },
    },
    {
      name: "Disqualified",
      isSystem: true,
      filtersJson: { status: ["DISQUALIFIED"] },
      sortJson: { field: "createdAt", direction: "desc" },
    },
  ];

  for (const view of views) {
    await prisma.savedView.upsert({
      where: { id: view.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: view,
    });
  }
  console.log("Seeded", views.length, "saved views");

  // Seed a sample referral partner
  await prisma.referralPartner.upsert({
    where: { id: "sample-partner" },
    update: {},
    create: {
      id: "sample-partner",
      name: "National Recovery Agency",
      active: true,
      contactName: "John Smith",
      email: "jsmith@nra-collections.example.com",
      phone: "(555) 987-6543",
      website: "https://nra-collections.example.com",
      statesServedJson: ["GA", "AL", "MS", "LA", "AR"],
      industriesServedJson: ["healthcare", "retail", "utilities"],
      specialtiesJson: ["small-balance", "high-volume"],
      preferredLeadTypesJson: ["commercial"],
      minimumClaimSize: 500,
      maximumClaimSize: 50000,
      rankingPriority: 1,
    },
  });
  console.log("Seeded sample referral partner");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
