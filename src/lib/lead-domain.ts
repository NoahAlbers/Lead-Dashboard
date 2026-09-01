// Derive the lead's business web domain from the website they gave us or
// their email address. Personal-mail domains say nothing about the business.

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
  "icloud.com", "live.com", "msn.com", "comcast.net", "att.net",
  "protonmail.com", "proton.me", "me.com", "ymail.com", "mail.com",
  "sbcglobal.net", "verizon.net", "bellsouth.net", "cox.net",
]);

export function leadWebDomain(website?: string | null, email?: string | null): string | null {
  if (website) {
    try {
      const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
      if (host.includes(".")) return host;
    } catch { /* fall through */ }
  }
  const domain = email?.split("@")[1]?.trim().toLowerCase();
  if (domain && domain.includes(".") && !FREE_EMAIL_DOMAINS.has(domain)) return domain;
  return null;
}
