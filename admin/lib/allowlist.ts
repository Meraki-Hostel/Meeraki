export function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}
