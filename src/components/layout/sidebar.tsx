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
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
  { label: "Scoring Rules", href: "/admin/rules", icon: Ruler, roles: ["ADMIN"] },
  { label: "Referral Partners", href: "/admin/partners", icon: Handshake, roles: ["ADMIN"] },
  { label: "Email Templates", href: "/admin/templates", icon: Mail, roles: ["ADMIN"] },
  { label: "Users", href: "/admin/users", icon: Users, roles: ["ADMIN"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
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

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/leads" className="flex items-center gap-2">
          <span className="bg-white rounded-lg px-3 py-1.5">
            <img src="/acb-logo.webp" alt="ACB" className="h-8" />
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount = item.badgeKey === "inbox" ? uncontactedCount : 0;
          return (
            <Link
              key={item.href}
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
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
