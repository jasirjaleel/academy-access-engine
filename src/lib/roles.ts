/**
 * Admins have app_metadata.role = "admin". Only the service role can write app_metadata,
 * so a student can't promote themselves (user_metadata is user-editable and never used for roles).
 */
export function isAdmin(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return user?.app_metadata?.role === "admin";
}
