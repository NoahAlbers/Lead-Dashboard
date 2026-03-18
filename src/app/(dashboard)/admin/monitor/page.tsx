import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LiveMonitor } from "@/components/admin/live-monitor";

export default async function MonitorPage() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    redirect("/leads");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time ingestion and form session monitoring
        </p>
      </div>
      <LiveMonitor />
    </div>
  );
}
