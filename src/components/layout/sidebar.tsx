"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Handshake,
  Mail,
  BarChart3,
  Ruler,
  ClipboardList,
  Bell,
  Activity,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
  badgeKey?: string;
}

const navItems: NavItem[] = [
  { label: "Lead Inbox", href: "/leads", icon: LayoutDashboard, badgeKey: "inbox" },
  { label: "Assignments", href: "/leads/assignments", icon: ClipboardList, roles: ["ADMIN", "MANAGER"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
  { label: "Live Monitor", href: "/admin/monitor", icon: Activity, roles: ["ADMIN", "MANAGER"] },
  { label: "Scoring Rules", href: "/admin/rules", icon: Ruler, roles: ["ADMIN"] },
  { label: "Referral Partners", href: "/admin/partners", icon: Handshake, roles: ["ADMIN"] },
  { label: "Email Templates", href: "/admin/templates", icon: Mail, roles: ["ADMIN"] },
  { label: "Users", href: "/admin/users", icon: Users, roles: ["ADMIN"] },
  { label: "My Settings", href: "/settings", icon: Bell },
  { label: "Admin Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar({
  userRole,
  uncontactedCount = 0,
}: {
  userRole: Role;
  uncontactedCount?: number;
}) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  // Sub-sections of the Admin Settings page (anchor links); shown when the
  // user is on that page so the long page is easy to navigate.
  const settingsSections = [
    { label: "Statuses & Tiers", hash: "#general" },
    { label: "SLA & Office Hours", hash: "#sla" },
    { label: "Lead Aging", hash: "#aging" },
    { label: "Lead Emails", hash: "#emails" },
    { label: "Abandoned Forms", hash: "#abandons" },
    { label: "Outcome Reasons", hash: "#outcomes" },
    { label: "Field Mapping", hash: "#field-mapping" },
    { label: "Ingestion Health", hash: "#ingestion" },
    { label: "Data Tools", hash: "#data-tools" },
    { label: "Integrations", hash: "#integrations" },
  ];

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/leads" className="flex items-center">
          <img src="/acb-logo.webp" alt="ACB" className="h-8 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount = item.badgeKey === "inbox" ? uncontactedCount : 0;
          const showSettingsSubmenu =
            item.href === "/admin/settings" && pathname.startsWith("/admin/settings");
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                    {badgeCount}
                  </span>
                )}
                {item.href === "/admin/settings" && (
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSettingsSubmenu && "rotate-180")} />
                )}
              </Link>
              {showSettingsSubmenu && (
                <div className="ml-7 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                  {settingsSections.map((s) => (
                    <a
                      key={s.hash}
                      href={`/admin/settings${s.hash}`}
                      className="block rounded px-2 py-1 text-xs text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
