"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  FileText,
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
}

const navItems: NavItem[] = [
  { label: "Lead Inbox", href: "/leads", icon: LayoutDashboard },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
  { label: "Scoring Rules", href: "/admin/rules", icon: Ruler, roles: ["ADMIN"] },
  { label: "Referral Partners", href: "/admin/partners", icon: Handshake, roles: ["ADMIN"] },
  { label: "Email Templates", href: "/admin/templates", icon: Mail, roles: ["ADMIN"] },
  { label: "Users", href: "/admin/users", icon: Users, roles: ["ADMIN"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar({ userRole }: { userRole: Role }) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/leads" className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">ACB Lead Console</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
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
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
