import crypto from "node:crypto";

export function createClaimToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashClaimToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function formatSupabaseStorageError(message: string) {
  if (
    message.includes("schema cache") ||
    message.includes("audit_reports") ||
    message.includes("audit_events")
  ) {
    return [
      "Supabase report tables are not ready.",
      "Run supabase/audit-reports.sql in the SQL editor for this project, then rerun the audit.",
      `Original Supabase error: ${message}`,
    ].join(" ");
  }

  return message;
}
