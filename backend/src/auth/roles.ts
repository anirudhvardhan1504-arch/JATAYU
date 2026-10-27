/**
 * JATAYU Security & Role-Based Access Control Specification.
 * Defines roles, capabilities, and deny-by-default permission checks.
 */

export const JATAYU_ROLES = Object.freeze({
  CITIZEN: 'CITIZEN',
  RESPONDER: 'RESPONDER',
  RESEARCHER: 'RESEARCHER',
  GOVERNMENT: 'GOVERNMENT',
  ADMIN: 'ADMIN',
} as const);

export type JatayuRole = (typeof JATAYU_ROLES)[keyof typeof JATAYU_ROLES];

/**
 * Least-privileged default role assigned to all public registrations.
 * Direct registration of any other role is strictly prohibited.
 */
export const DEFAULT_PUBLIC_ROLE: JatayuRole = JATAYU_ROLES.CITIZEN;

export const JATAYU_PERMISSIONS = Object.freeze({
  VIEW_PUBLIC_MAP: 'map:view_2d',
  VIEW_PUBLIC_WEATHER: 'weather:view_public',
  VIEW_OFFICIAL_ALERTS: 'alerts:view_official',
  VIEW_INDICATIVE_RISK: 'risk:view_indicative',
  VIEW_RADAR_OVERLAY: 'radar:view_overlay',
  VIEW_3D_COMMAND_GLOBE: 'command3d:view_globe',
  INTERROGATE_DISTRICT_TELEMETRY: 'district:interrogate_telemetry',
  VIEW_OPERATIONAL_SECTORS: 'command:view_sectors',
  TRIGGER_SIMULATION_DRILLS: 'drill:trigger_simulation',
  MANAGE_USERS_ROLES: 'admin:manage_roles',
} as const);

export type JatayuPermission = (typeof JATAYU_PERMISSIONS)[keyof typeof JATAYU_PERMISSIONS];

/**
 * Deny-by-default role permission matrix.
 * Explicitly maps roles to their authorized capabilities.
 */
export const ROLE_PERMISSIONS_MATRIX: Readonly<Record<JatayuRole, readonly JatayuPermission[]>> = Object.freeze({
  [JATAYU_ROLES.CITIZEN]: Object.freeze([
    JATAYU_PERMISSIONS.VIEW_PUBLIC_MAP,
    JATAYU_PERMISSIONS.VIEW_PUBLIC_WEATHER,
    JATAYU_PERMISSIONS.VIEW_OFFICIAL_ALERTS,
    JATAYU_PERMISSIONS.VIEW_INDICATIVE_RISK,
    JATAYU_PERMISSIONS.VIEW_RADAR_OVERLAY,
  ]),
  [JATAYU_ROLES.RESPONDER]: Object.freeze([
    JATAYU_PERMISSIONS.VIEW_PUBLIC_MAP,
    JATAYU_PERMISSIONS.VIEW_PUBLIC_WEATHER,
    JATAYU_PERMISSIONS.VIEW_OFFICIAL_ALERTS,
    JATAYU_PERMISSIONS.VIEW_INDICATIVE_RISK,
    JATAYU_PERMISSIONS.VIEW_RADAR_OVERLAY,
    JATAYU_PERMISSIONS.INTERROGATE_DISTRICT_TELEMETRY,
    JATAYU_PERMISSIONS.VIEW_OPERATIONAL_SECTORS,
  ]),
  [JATAYU_ROLES.RESEARCHER]: Object.freeze([
    JATAYU_PERMISSIONS.VIEW_PUBLIC_MAP,
    JATAYU_PERMISSIONS.VIEW_PUBLIC_WEATHER,
    JATAYU_PERMISSIONS.VIEW_OFFICIAL_ALERTS,
    JATAYU_PERMISSIONS.VIEW_INDICATIVE_RISK,
    JATAYU_PERMISSIONS.VIEW_RADAR_OVERLAY,
    JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE,
    JATAYU_PERMISSIONS.INTERROGATE_DISTRICT_TELEMETRY,
    JATAYU_PERMISSIONS.VIEW_OPERATIONAL_SECTORS,
  ]),
  [JATAYU_ROLES.GOVERNMENT]: Object.freeze([
    JATAYU_PERMISSIONS.VIEW_PUBLIC_MAP,
    JATAYU_PERMISSIONS.VIEW_PUBLIC_WEATHER,
    JATAYU_PERMISSIONS.VIEW_OFFICIAL_ALERTS,
    JATAYU_PERMISSIONS.VIEW_INDICATIVE_RISK,
    JATAYU_PERMISSIONS.VIEW_RADAR_OVERLAY,
    JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE,
    JATAYU_PERMISSIONS.INTERROGATE_DISTRICT_TELEMETRY,
    JATAYU_PERMISSIONS.VIEW_OPERATIONAL_SECTORS,
    JATAYU_PERMISSIONS.TRIGGER_SIMULATION_DRILLS,
  ]),
  [JATAYU_ROLES.ADMIN]: Object.freeze([
    ...Object.values(JATAYU_PERMISSIONS),
  ]),
});

/**
 * Validate whether a string is a legitimate JATAYU role.
 */
export function isValidRole(role: unknown): role is JatayuRole {
  return typeof role === 'string' && Object.values(JATAYU_ROLES).includes(role as JatayuRole);
}

/**
 * Validate whether a string is a legitimate JATAYU permission.
 */
export function isValidPermission(permission: unknown): permission is JatayuPermission {
  return typeof permission === 'string' && Object.values(JATAYU_PERMISSIONS).includes(permission as JatayuPermission);
}

/**
 * Assert that a role is valid, throwing if not.
 */
export function assertValidRole(role: unknown): asserts role is JatayuRole {
  if (!isValidRole(role)) {
    throw new Error(`Invalid role: '${String(role)}'. Must be one of: ${Object.values(JATAYU_ROLES).join(', ')}`);
  }
}

/**
 * Retrieve permissions for a role. Returns empty frozen array if role is invalid.
 */
export function getPermissionsForRole(role: string): readonly JatayuPermission[] {
  if (!isValidRole(role)) return Object.freeze([]);
  return ROLE_PERMISSIONS_MATRIX[role] || Object.freeze([]);
}

/**
 * Check whether a verified role possesses a specific permission.
 * Deny by default: unknown roles or permissions immediately return false.
 */
export function hasPermission(role: string | undefined | null, permission: string | undefined | null): boolean {
  if (!role || !permission) return false;
  if (!isValidRole(role)) return false;
  const permissions = ROLE_PERMISSIONS_MATRIX[role];
  if (!permissions) return false;
  return permissions.includes(permission as JatayuPermission);
}
