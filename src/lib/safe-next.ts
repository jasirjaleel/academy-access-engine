/** Only same-site paths, so a crafted ?redirect_url can't send people to another site. */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  const next = typeof value === "string" ? value : "";
  // Browsers read "/\evil.com" as "//evil.com", so backslashes and control characters are refused too.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
