"use client";

import { signOut } from "next-auth/react";
import { LogOut, Menu, Search, User } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { OPEN_MOBILE_NAV_EVENT } from "./sidebar";

interface HeaderProps {
  userName: string;
  userRole: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function Header({ userName, userRole }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-primary/20 bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_MOBILE_NAV_EVENT))}
          aria-label="Open navigation"
          title="Menu"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          aria-label="Search"
          title="Search (Ctrl+K)"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
        </button>
        <NotificationBell />
        {/* Full name + role on lg and up */}
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{userName}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {userRole}
          </span>
        </div>
        {/* Initials chip below lg */}
        <span
          title={`${userName} (${userRole})`}
          aria-label={`${userName}, ${userRole}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground lg:hidden"
        >
          {getInitials(userName)}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign Out"
          title="Sign Out"
          className="flex items-center gap-1 rounded-md p-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors lg:px-2 lg:py-1"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
