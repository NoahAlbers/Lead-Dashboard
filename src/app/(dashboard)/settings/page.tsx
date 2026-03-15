import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyNotificationPreferences, getMySoundPreferences } from "@/actions/preferences.actions";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default async function UserSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [notifPrefs, soundPrefs] = await Promise.all([
    getMyNotificationPreferences(),
    getMySoundPreferences(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notification and sound preferences
        </p>
      </div>

      <NotificationSettings
        initialNotifPrefs={notifPrefs}
        initialSoundPrefs={soundPrefs}
      />
    </div>
  );
}
