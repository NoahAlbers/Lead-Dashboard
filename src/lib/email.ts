import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM_EMAIL =
  process.env.EMAIL_FROM ?? "ACB Lead Console <leads@advancedcb.app>";

export function getNotificationEmails(): string[] {
  return (process.env.NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.warn("[EMAIL] RESEND_API_KEY not set, skipping email");
    return { success: false, error: "No API key" };
  }
  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
    return { success: true };
  } catch (err) {
    console.error("[EMAIL] Send failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
