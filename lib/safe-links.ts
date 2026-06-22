const ALLOWED_TEAMS_HOSTS = new Set([
  "teams.microsoft.com",
  "teams.live.com",
  "teams.cloud.microsoft",
]);

export function isAllowedTeamsHref(href: string) {
  try {
    const url = new URL(href.trim());
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    return ALLOWED_TEAMS_HOSTS.has(host) || host.endsWith(".teams.microsoft.com");
  } catch {
    return false;
  }
}

export function isSafeInternalHref(href: string) {
  const value = href.trim();
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

export function sanitizeNotificationHref(href?: string | null) {
  const value = String(href ?? "").trim();
  if (!value) return null;
  if (isSafeInternalHref(value)) return value;
  if (isAllowedTeamsHref(value)) return value;
  return null;
}
