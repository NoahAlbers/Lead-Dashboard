import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { FaviconManager } from "@/components/layout/favicon-manager";
import { SoundProvider } from "@/components/layout/sound-manager";
import { WorkingModeProvider } from "@/components/leads/working-mode-provider";
import { AutoRefreshProvider } from "@/components/shared/auto-refresh-provider";
import { KeyboardShortcutProvider } from "@/components/shared/keyboard-shortcut-provider";
import { ShortcutHelpModal } from "@/components/shared/shortcut-help-modal";
import { getUnreadCount } from "@/actions/lead.actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const unreadCount = await getUnreadCount();

  return (
    <SoundProvider>
    <AutoRefreshProvider>
    <KeyboardShortcutProvider>
    <WorkingModeProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          userRole={session.user.role}
          uncontactedCount={unreadCount}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            userName={session.user.name}
            userRole={session.user.role}
          />
          <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
            {children}
          </main>
          <FaviconManager />
        </div>
      </div>
      <ShortcutHelpModal />
    </WorkingModeProvider>
    </KeyboardShortcutProvider>
    </AutoRefreshProvider>
    </SoundProvider>
  );
}
