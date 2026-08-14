/**
 * Where each role lands after signing in.
 *
 * Shared by login, OTP verification and password reset so a new role only has
 * to be added once — an earlier version branched on OWNER alone and dropped
 * admins on the tenant dashboard.
 */
export const HOME_BY_ROLE: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  OWNER:       '/owner/dashboard',
  TENANT:      '/tenant/dashboard',
}
