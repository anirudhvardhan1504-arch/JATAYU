import { fetchJson } from './api';

export interface AdminAlert {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'EMERGENCY' | 'WARNING' | 'WATCH' | 'ADVISORY';
  affectedArea: string;
  source: string;
  isOfficial: boolean;
  publishedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'WITHDRAWN';
  verificationStatus: 'ADMIN_ADVISORY' | 'OFFICIAL_GOVERNMENT';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFacility {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  district: string;
  phone?: string;
  responsibleAuthority?: string;
  verificationStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | 'UNVERIFIED' | 'REJECTED' | 'INACTIVE';
  lastVerified?: string;
  operationalStatus: string;
  accessibilityInfo?: string;
  capacity?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: 'ALERT' | 'FACILITY' | 'USER_ROLE' | 'SOURCE';
  targetId: string;
  details: string;
  performedBy: string;
  timestamp: string;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  category: string;
  endpoint: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  lastSuccess: string;
  lastFailure: string | null;
  latencyMs: number;
  freshness: string;
  isConfigured: boolean;
  notes: string;
}

export interface AdminOverviewMetrics {
  totalFacilities: number;
  verifiedFacilities: number;
  pendingFacilities: number;
  activeAlerts: number;
  expiredAlerts: number;
  sourcesOnline: number;
  totalSources: number;
  recentActivities: AuditLogEntry[];
}

export async function getAdminOverview(): Promise<AdminOverviewMetrics> {
  return fetchJson<AdminOverviewMetrics>('/admin/overview');
}

export async function getAdminAlerts(status?: string): Promise<{ alerts: AdminAlert[]; count: number }> {
  const query = status && status !== 'ALL' ? `?status=${status}` : '';
  return fetchJson<{ alerts: AdminAlert[]; count: number }>(`/admin/alerts${query}`);
}

export async function createAdminAlert(data: {
  title: string;
  description: string;
  category: string;
  severity: 'EMERGENCY' | 'WARNING' | 'WATCH' | 'ADVISORY';
  affectedArea: string;
  expiresAt?: string;
}): Promise<{ message: string; alert: AdminAlert }> {
  return fetchJson<{ message: string; alert: AdminAlert }>('/admin/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminAlert(
  id: string,
  data: Partial<AdminAlert>
): Promise<{ message: string; alert: AdminAlert }> {
  return fetchJson<{ message: string; alert: AdminAlert }>(`/admin/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function withdrawAdminAlert(id: string): Promise<{ message: string; alert: AdminAlert }> {
  return fetchJson<{ message: string; alert: AdminAlert }>(`/admin/alerts/${id}`, {
    method: 'DELETE',
  });
}

export async function getAdminFacilities(filter?: {
  status?: string;
  category?: string;
}): Promise<{ facilities: AdminFacility[]; count: number }> {
  const params = new URLSearchParams();
  if (filter?.status && filter.status !== 'ALL') params.set('status', filter.status);
  if (filter?.category && filter.category !== 'ALL') params.set('category', filter.category);
  const q = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<{ facilities: AdminFacility[]; count: number }>(`/admin/facilities${q}`);
}

export async function createAdminFacility(data: {
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  district: string;
  phone?: string;
  responsibleAuthority?: string;
  capacity?: number;
  notes?: string;
}): Promise<{ message: string; facility: AdminFacility }> {
  return fetchJson<{ message: string; facility: AdminFacility }>('/admin/facilities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyAdminFacility(
  id: string,
  status: 'VERIFIED' | 'REJECTED' | 'INACTIVE',
  notes?: string
): Promise<{ message: string; facility: AdminFacility }> {
  return fetchJson<{ message: string; facility: AdminFacility }>(`/admin/facilities/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ status, notes }),
  });
}

export async function getAdminSources(): Promise<{ sources: DataSourceStatus[]; count: number }> {
  return fetchJson<{ sources: DataSourceStatus[]; count: number }>('/admin/sources');
}

export async function getAdminAuditLogs(limit = 50): Promise<{ logs: AuditLogEntry[]; count: number }> {
  return fetchJson<{ logs: AuditLogEntry[]; count: number }>(`/admin/audit-logs?limit=${limit}`);
}
