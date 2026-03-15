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

  // Delete old scoring rules that reference balanceAmount
  await prisma.scoringRule.deleteMany({
    where: {
      name: { in: ["High Portfolio Value", "Very Small Portfolio"] },
    },
  });
  console.log("Cleaned up old scoring rules referencing balanceAmount");

  // Seed default scoring rules — tuned for ACB's residential rental debt focus
  // Only uses real form fields: state, debtType, urgency, accountVolume, email, phone, companyName
  const rules = [
    {
      name: "Missing Contact Info",
      description: "Missing both email and phone — hard stop",
      priority: 1,
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
      name: "Florida Target Market",
      description: "Lead is in Florida — ACB primary market",
      priority: 10,
      conditionsJson: [
        { field: "state", operator: "equals", value: "FL" },
      ],
      outcomesJson: { scoreAdjustment: 15, reason: "Florida target market" },
    },
    {
      name: "Residential Rental Debt",
      description: "Lead has residential rental debt — ACB core service",
      priority: 15,
      conditionsJson: [
        { field: "debtType", operator: "contains", value: "Residential Rental Debt" },
      ],
      outcomesJson: {
        scoreAdjustment: 20,
        reason: "Residential rental debt — core ACB service",
      },
    },
    {
      name: "Debts Ready Now",
      description: "Lead has debts ready to place now (high urgency)",
      priority: 18,
      conditionsJson: [
        { field: "urgency", operator: "equals", value: "high" },
      ],
      outcomesJson: {
        scoreAdjustment: 10,
        reason: "Debts ready to place now",
      },
    },
    {
      name: "Large Portfolio",
      description: "Lead has 50+ units — high-value portfolio",
      priority: 20,
      conditionsJson: [
        { field: "accountVolume", operator: "greater_than", value: 50 },
      ],
      outcomesJson: {
        scoreAdjustment: 15,
        reason: "Large portfolio (50+ units)",
      },
    },
    {
      name: "Complete Contact Info",
      description: "Lead has both email and phone",
      priority: 30,
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
      name: "Has Company",
      description: "Lead represents a property management company",
      priority: 35,
      conditionsJson: [
        { field: "companyName", operator: "is_not_empty", value: "" },
      ],
      outcomesJson: {
        scoreAdjustment: 5,
        reason: "Represents a company",
      },
    },
    {
      name: "Outside Target Geography",
      description: "Lead is not in a preferred state",
      priority: 50,
      conditionsJson: [
        {
          field: "state",
          operator: "not_in",
          value: ["FL", "GA", "AL", "SC", "NC", "TN", "TX", "NY", "CA"],
        },
      ],
      outcomesJson: {
        scoreAdjustment: -15,
        reason: "Outside target geography",
      },
    },
  ];

  for (const rule of rules) {
    await prisma.scoringRule.upsert({
      where: { id: rule.name.toLowerCase().replace(/\s+/g, "-") },
      update: {
        conditionsJson: rule.conditionsJson,
        outcomesJson: rule.outcomesJson,
        description: rule.description,
        priority: rule.priority,
      },
      create: rule,
    });
  }
  console.log("Seeded", rules.length, "scoring rules");

  // Seed default email types
  const emailTypes = [
    { id: "type-intro", name: "Intro", color: "#B3D4FF", isReferral: false, isDefault: true, sortOrder: 1 },
    { id: "type-follow-up", name: "Follow-Up", color: "#FFF3B3", isReferral: false, isDefault: true, sortOrder: 2 },
    { id: "type-referral", name: "Referral", color: "#FFDAB3", isReferral: true, isDefault: true, sortOrder: 3 },
    { id: "type-internal", name: "Internal Handoff", color: "#C7B3FF", isReferral: false, isDefault: true, sortOrder: 4 },
  ];
  for (const et of emailTypes) {
    await prisma.emailType.upsert({
      where: { id: et.id },
      update: {},
      create: et,
    });
  }
  console.log("Seeded", emailTypes.length, "email types");

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

  // Seed default custom statuses with colors
  const defaultStatuses = [
    { name: "New", color: "#B3D4FF", type: "status", sortOrder: 1, isDefault: true },
    { name: "Reviewed", color: "#D4F5D4", type: "status", sortOrder: 2, isDefault: true },
    { name: "Qualified", color: "#D4F5D4", type: "status", sortOrder: 3, isDefault: true },
    { name: "Contacted", color: "#B3E8F5", type: "status", sortOrder: 4, isDefault: true },
    { name: "Follow-Up Needed", color: "#FFF3B3", type: "status", sortOrder: 5, isDefault: true },
    { name: "Referred Out", color: "#FFDAB3", type: "status", sortOrder: 6, isDefault: true },
    { name: "Imported to CRM", color: "#C7B3FF", type: "status", sortOrder: 7, isDefault: true },
    { name: "Won", color: "#B3E8D4", type: "status", sortOrder: 8, isDefault: true },
    { name: "Lost", color: "#FFB3B3", type: "status", sortOrder: 9, isDefault: true },
    { name: "Disqualified", color: "#FFB3B3", type: "status", sortOrder: 10, isDefault: true },
    { name: "Duplicate", color: "#D4D4D4", type: "status", sortOrder: 11, isDefault: true },
    { name: "Archived", color: "#D4D4D4", type: "status", sortOrder: 12, isDefault: true },
  ];

  const defaultTiers = [
    { name: "A Lead (80-100)", color: "#B3E8D4", type: "tier", sortOrder: 1, isDefault: true },
    { name: "B Lead (60-79)", color: "#B3D4FF", type: "tier", sortOrder: 2, isDefault: true },
    { name: "C Lead (40-59)", color: "#FFF3B3", type: "tier", sortOrder: 3, isDefault: true },
    { name: "Poor Fit (0-39)", color: "#FFB3B3", type: "tier", sortOrder: 4, isDefault: true },
  ];

  for (const status of [...defaultStatuses, ...defaultTiers]) {
    await prisma.customStatus.upsert({
      where: { id: `${status.type}-${status.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `${status.type}-${status.name.toLowerCase().replace(/\s+/g, "-")}`,
        ...status,
      },
    });
  }
  console.log("Seeded default custom statuses and tiers");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
