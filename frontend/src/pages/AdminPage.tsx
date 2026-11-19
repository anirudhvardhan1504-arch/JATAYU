import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  BellRing,
  Building2,
  Database,
  History,
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  LogIn,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AdminAlert,
  AdminFacility,
  AuditLogEntry,
  DataSourceStatus,
  AdminOverviewMetrics,
  getAdminOverview,
  getAdminAlerts,
  createAdminAlert,
  withdrawAdminAlert,
  getAdminFacilities,
  createAdminFacility,
  verifyAdminFacility,
  getAdminSources,
  getAdminAuditLogs,
} from '../services/admin';

interface AdminPageProps {
  onOpenLogin?: () => void;
}

type AdminSubTab = 'overview' | 'alerts' | 'facilities' | 'sources' | 'audit';

export const AdminPage: React.FC<AdminPageProps> = ({ onOpenLogin }) => {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSubTab>('overview');

  // Overview State
  const [overview, setOverview] = useState<AdminOverviewMetrics | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  // Alerts State
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>('ALL');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [newAlert, setNewAlert] = useState({
    title: '',
    description: '',
    category: 'FLOOD',
    severity: 'WARNING' as 'EMERGENCY' | 'WARNING' | 'WATCH' | 'ADVISORY',
    affectedArea: '',
    expiresInHours: 24,
  });

  // Facilities State
  const [facilities, setFacilities] = useState<AdminFacility[]>([]);
  const [facilityStatusFilter, setFacilityStatusFilter] = useState<string>('ALL');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
  const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
  const [newFacility, setNewFacility] = useState({
    name: '',
    category: 'SHELTER',
    latitude: '',
    longitude: '',
    address: '',
    district: '',
    phone: '',
    responsibleAuthority: '',
    capacity: '200',
    notes: '',
  });

  // Data Sources State
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check clearance
  const isAdmin = user && (user.role === 'ADMIN' || hasPermission('admin:manage_roles'));

  const flashMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  const flashError = (err: string) => {
    setErrorMessage(err);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Loaders
  const loadOverview = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingOverview(true);
    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (err: any) {
      console.warn('Overview fetch error:', err);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [isAdmin]);

  const loadAlerts = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingAlerts(true);
    try {
      const res = await getAdminAlerts(alertStatusFilter);
      setAlerts(res.alerts);
    } catch (err: any) {
      flashError(err.message || 'Failed to load alerts');
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [isAdmin, alertStatusFilter]);

  const loadFacilities = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingFacilities(true);
    try {
      const res = await getAdminFacilities({ status: facilityStatusFilter });
      setFacilities(res.facilities);
    } catch (err: any) {
      flashError(err.message || 'Failed to load facilities');
    } finally {
      setIsLoadingFacilities(false);
    }
  }, [isAdmin, facilityStatusFilter]);

  const loadSources = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingSources(true);
    try {
      const res = await getAdminSources();
      setSources(res.sources);
    } catch (err: any) {
      flashError(err.message || 'Failed to load data sources');
    } finally {
      setIsLoadingSources(false);
    }
  }, [isAdmin]);

  const loadAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingLogs(true);
    try {
      const res = await getAdminAuditLogs(50);
      setAuditLogs(res.logs);
    } catch (err: any) {
      flashError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoadingLogs(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    else if (activeTab === 'alerts') loadAlerts();
    else if (activeTab === 'facilities') loadFacilities();
    else if (activeTab === 'sources') loadSources();
    else if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, loadOverview, loadAlerts, loadFacilities, loadSources, loadAuditLogs]);

  // Actions
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expiresAt = new Date(Date.now() + newAlert.expiresInHours * 3600 * 1000).toISOString();
      await createAdminAlert({
        title: newAlert.title,
        description: newAlert.description,
        category: newAlert.category,
        severity: newAlert.severity,
        affectedArea: newAlert.affectedArea,
        expiresAt,
      });
      setIsAlertModalOpen(false);
      setNewAlert({
        title: '',
        description: '',
        category: 'FLOOD',
        severity: 'WARNING',
        affectedArea: '',
        expiresInHours: 24,
      });
      flashMessage('Administrative advisory alert created and published.');
      loadAlerts();
      loadOverview();
    } catch (err: any) {
      flashError(err.message || 'Alert creation failed');
    }
  };

  const handleWithdrawAlert = async (id: string) => {
    if (!window.confirm('Withdraw this administrative advisory alert?')) return;
    try {
      await withdrawAdminAlert(id);
      flashMessage('Alert marked as WITHDRAWN.');
      loadAlerts();
    } catch (err: any) {
      flashError(err.message || 'Failed to withdraw alert');
    }
  };

  const handleVerifyFacility = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await verifyAdminFacility(id, status, `Verified by admin ${user?.username}`);
      flashMessage(`Facility marked as ${status}.`);
      loadFacilities();
      loadOverview();
    } catch (err: any) {
      flashError(err.message || 'Facility verification update failed');
    }
  };

  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminFacility({
        name: newFacility.name,
        category: newFacility.category,
        latitude: parseFloat(newFacility.latitude),
        longitude: parseFloat(newFacility.longitude),
        address: newFacility.address,
        district: newFacility.district,
        phone: newFacility.phone || undefined,
        responsibleAuthority: newFacility.responsibleAuthority || undefined,
        capacity: newFacility.capacity ? parseInt(newFacility.capacity, 10) : undefined,
        notes: newFacility.notes || undefined,
      });
      setIsFacilityModalOpen(false);
      setNewFacility({
        name: '',
        category: 'SHELTER',
        latitude: '',
        longitude: '',
        address: '',
        district: '',
        phone: '',
        responsibleAuthority: '',
        capacity: '200',
        notes: '',
      });
      flashMessage('Emergency facility registered (Status: PENDING_VERIFICATION).');
      loadFacilities();
      loadOverview();
    } catch (err: any) {
      flashError(err.message || 'Facility creation failed');
    }
  };

  // If not authenticated or not admin, show clearance screen
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="bento-card max-w-xl mx-auto my-12 p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Administrative Clearance Required
        </h2>
        <p className="text-xs text-jatayu-secondary font-sans leading-relaxed">
          Access to the JATAYU Operations Control & Resource Management console is restricted to authenticated system administrators with the <strong className="text-amber-400">ADMIN</strong> role.
        </p>
        <div className="p-3.5 bg-obsidian/80 border border-white/10 rounded-xl text-[11px] font-mono text-jatayu-secondary text-left space-y-1">
          <div className="text-amber-400 font-bold uppercase">Authorized Access Protocol:</div>
          <div>• Log in with an administrator identity (e.g. <code>admin@jatayu.gov.in</code>)</div>
          <div>• Direct backend RBAC enforcement guarantees integrity across all public feeds</div>
        </div>
        {onOpenLogin && (
          <button
            onClick={onOpenLogin}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-mint text-slate-950 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,217,154,0.3)]"
          >
            <LogIn className="w-4 h-4" />
            <span>Administrator Sign In</span>
          </button>
        )}
      </div>
    );
  }

  const filteredFacilities = facilities.filter((f) => {
    if (!facilitySearch.trim()) return true;
    const q = facilitySearch.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.address.toLowerCase().includes(q) ||
      f.district.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>OPERATIONAL CONTROL CONSOLE</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
            Administrative Operations & Resource Management
          </h1>
          <p className="text-xs text-jatayu-secondary mt-0.5 font-sans">
            Logged in as <strong className="text-emerald-300 font-mono">{user.username}</strong> ({user.role}). Audit logging active.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center bg-obsidian/70 p-1.5 rounded-2xl border border-white/10 text-xs font-mono gap-1">
          {[
            { id: 'overview' as const, label: 'Overview', icon: <Activity className="w-3.5 h-3.5" /> },
            { id: 'alerts' as const, label: 'Alerts', icon: <BellRing className="w-3.5 h-3.5" /> },
            { id: 'facilities' as const, label: 'Facilities', icon: <Building2 className="w-3.5 h-3.5" /> },
            { id: 'sources' as const, label: 'Data Sources', icon: <Database className="w-3.5 h-3.5" /> },
            { id: 'audit' as const, label: 'Audit Logs', icon: <History className="w-3.5 h-3.5" /> },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(0,217,154,0.2)]'
                  : 'text-jatayu-secondary hover:text-white border border-transparent'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs font-mono flex items-center gap-2 animate-fade-in shadow-[0_0_15px_rgba(0,217,154,0.2)]">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-red-950/60 border border-red-500/40 text-red-200 rounded-xl text-xs font-mono flex items-center gap-2 animate-fade-in shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SUB-TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Facilities', val: overview?.totalFacilities ?? '—', color: 'text-blue-400' },
              { label: 'Verified Facilities', val: overview?.verifiedFacilities ?? '—', color: 'text-emerald-400' },
              { label: 'Pending Verification', val: overview?.pendingFacilities ?? '—', color: 'text-amber-400' },
              { label: 'Active Alerts', val: overview?.activeAlerts ?? '—', color: 'text-red-400' },
              { label: 'Expired / Withdrawn', val: overview?.expiredAlerts ?? '—', color: 'text-jatayu-muted' },
              {
                label: 'Data Feeds Online',
                val: overview ? `${overview.sourcesOnline}/${overview.totalSources}` : '—',
                color: 'text-mint',
              },
            ].map(({ label, val, color }, idx) => (
              <div key={idx} className="bento-card p-4 space-y-1">
                <span className="text-[10px] font-mono uppercase text-jatayu-muted font-semibold tracking-wider">
                  {label}
                </span>
                <div className={`text-2xl font-bold font-mono ${color}`}>{val}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions & Recent Activities Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Quick Actions (4 cols) */}
            <div className="lg:col-span-4 bento-card p-5 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Administrative Quick Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setActiveTab('alerts');
                    setIsAlertModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 bg-red-600/80 hover:bg-red-600 border border-red-500/40 text-white rounded-xl text-xs font-mono font-semibold flex items-center justify-between transition-all cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Create Advisory Alert</span>
                  </span>
                  <span className="text-[10px] font-sans opacity-80">Public Broadcast</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('facilities');
                    setIsFacilityModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500/40 text-white rounded-xl text-xs font-mono font-semibold flex items-center justify-between transition-all cursor-pointer shadow-[0_0_12px_rgba(0,217,154,0.2)]"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>Register Emergency Facility</span>
                  </span>
                  <span className="text-[10px] font-sans opacity-80">Shelter / Trauma</span>
                </button>

                <button
                  onClick={() => setActiveTab('sources')}
                  className="w-full py-2.5 px-3 bg-obsidian hover:bg-white/5 border border-white/10 text-white rounded-xl text-xs font-mono font-semibold flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-mint" />
                    <span>Inspect Data Feed Health</span>
                  </span>
                  <span className="text-[10px] font-sans opacity-80">7 Sources</span>
                </button>
              </div>

              <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed font-sans mt-3">
                <strong className="text-amber-300">Administrative Ethics:</strong> Administrative alerts represent localized emergency advisories. Never falsely classify an unofficial notice as an official IMD meteorological warning.
              </div>
            </div>

            {/* Recent Audit Activities (8 cols) */}
            <div className="lg:col-span-8 bento-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Recent Administrative Activities (Audit Trail)
                </h3>
                <button
                  onClick={loadOverview}
                  className="text-xs text-emerald-400 hover:text-mint font-mono flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingOverview ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {overview?.recentActivities && overview.recentActivities.length > 0 ? (
                  overview.recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 bg-obsidian/70 border border-white/10 rounded-xl text-xs flex items-start justify-between gap-3 font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                            {act.action}
                          </span>
                          <span className="text-jatayu-muted text-[10px]">by {act.performedBy}</span>
                        </div>
                        <p className="text-jatayu-primary font-sans text-xs">{act.details}</p>
                      </div>
                      <span className="text-[10px] text-jatayu-muted whitespace-nowrap">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-jatayu-muted font-mono">
                    No administrative audit events recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ALERTS MANAGEMENT */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bento-card p-4">
            {/* Filters */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-jatayu-muted uppercase font-semibold">Status:</span>
              {['ALL', 'ACTIVE', 'EXPIRED', 'WITHDRAWN'].map((st) => (
                <button
                  key={st}
                  onClick={() => setAlertStatusFilter(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                    alertStatusFilter === st
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)] font-bold'
                      : 'bg-obsidian/70 text-jatayu-secondary hover:text-white border border-white/10'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="px-3.5 py-1.5 bg-red-600/80 hover:bg-red-600 border border-red-500/40 text-white rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.2)] self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Alert</span>
            </button>
          </div>

          {/* Alerts List */}
          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alt) => (
                <div
                  key={alt.id}
                  className="bento-card p-4 space-y-2 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          alt.severity === 'EMERGENCY'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : alt.severity === 'WARNING'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {alt.severity}
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-obsidian text-emerald-300 border border-white/10">
                        {alt.category}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-300 border border-amber-500/30">
                        ADMIN ADVISORY (NOT OFFICIAL IMD)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                          alt.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)]'
                            : 'bg-obsidian text-jatayu-muted border border-white/10'
                        }`}
                      >
                        STATUS: {alt.status}
                      </span>
                      {alt.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleWithdrawAlert(alt.id)}
                          className="px-2.5 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-mono font-semibold cursor-pointer transition-colors"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white">{alt.title}</h3>
                    <p className="text-xs text-jatayu-secondary font-sans mt-0.5 leading-relaxed">
                      {alt.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] font-mono text-jatayu-muted gap-2">
                    <div>
                      <span>Area: <strong className="text-white">{alt.affectedArea}</strong></span>
                      <span className="mx-2">•</span>
                      <span>Published by: <strong className="text-emerald-300">{alt.createdBy}</strong></span>
                    </div>
                    <div>
                      <span>Expires: {new Date(alt.expiresAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 bento-card text-center text-xs text-jatayu-muted font-mono">
                {isLoadingAlerts ? 'Querying administrative alerts registry...' : 'No administrative alerts match the selected filter.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: EMERGENCY FACILITIES MANAGEMENT */}
      {activeTab === 'facilities' && (
        <div className="space-y-4">
          <div className="bento-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-jatayu-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
                placeholder="Search facility name, address, or district..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            {/* Filter & Add Button */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {['ALL', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFacilityStatusFilter(st)}
                    className={`px-3 py-1 rounded-xl text-xs transition-all cursor-pointer ${
                      facilityStatusFilter === st
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)] font-bold'
                        : 'bg-obsidian/70 text-jatayu-secondary hover:text-white border border-white/10'
                    }`}
                  >
                    {st === 'PENDING_VERIFICATION' ? 'PENDING' : st}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsFacilityModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-mint text-slate-950 rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,217,154,0.25)]"
              >
                <Plus className="w-4 h-4" />
                <span>Register Facility</span>
              </button>
            </div>
          </div>

          {/* Facility Table */}
          <div className="bento-card overflow-x-auto p-0">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-obsidian/80 border-b border-white/10 text-emerald-400 font-mono text-[11px] uppercase">
                  <th className="py-3 px-4 font-semibold">Facility Name & Category</th>
                  <th className="py-3 px-4 font-semibold">Location / District</th>
                  <th className="py-3 px-4 font-semibold">Verification Status</th>
                  <th className="py-3 px-4 font-semibold">Capacity</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {filteredFacilities.length > 0 ? (
                  filteredFacilities.map((fac) => (
                    <tr key={fac.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{fac.name}</div>
                        <div className="text-[11px] text-jatayu-muted font-mono">{fac.category}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-jatayu-primary line-clamp-1">{fac.address}</div>
                        <div className="text-[11px] text-jatayu-muted font-mono">
                          {fac.district} ({fac.latitude.toFixed(3)}, {fac.longitude.toFixed(3)})
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            fac.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : fac.verificationStatus === 'PENDING_VERIFICATION'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                              : 'bg-obsidian text-jatayu-muted border border-white/10'
                          }`}
                        >
                          {fac.verificationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-300">
                        {fac.capacity ? `${fac.capacity} persons` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {fac.verificationStatus === 'PENDING_VERIFICATION' ? (
                          <>
                            <button
                              onClick={() => handleVerifyFacility(fac.id, 'VERIFIED')}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-mint text-slate-950 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors shadow-[0_0_8px_rgba(0,217,154,0.2)]"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleVerifyFacility(fac.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-[11px] font-mono font-semibold cursor-pointer transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-mono text-jatayu-muted">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-jatayu-muted font-mono">
                      {isLoadingFacilities ? 'Loading registered facilities...' : 'No facilities matched search or filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DATA SOURCES TELEMETRY */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bento-card p-4">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                External Upstream Data Feeds
              </h3>
              <p className="text-xs text-jatayu-secondary font-sans mt-0.5">
                Real-time connection telemetry, endpoint health, and freshness SLAs across all provider integrations.
              </p>
            </div>
            <button
              onClick={loadSources}
              className="px-3.5 py-1.5 bg-obsidian hover:bg-white/5 text-emerald-300 border border-white/10 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSources ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Test Connectivity</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sources.map((src) => (
              <div
                key={src.id}
                className="bento-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-jatayu-muted font-semibold">
                      {src.category}
                    </span>
                    <h4 className="text-sm font-bold text-white leading-snug">
                      {src.name}
                    </h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      src.status === 'ONLINE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.15)]'
                        : src.status === 'DEGRADED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {src.status}
                  </span>
                </div>

                <div className="p-2.5 bg-obsidian/70 rounded-xl border border-white/10 text-[11px] font-mono text-emerald-400 break-all">
                  {src.endpoint}
                </div>

                <p className="text-xs text-jatayu-secondary font-sans leading-relaxed">
                  {src.notes}
                </p>

                <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] font-mono text-jatayu-muted">
                  <div>
                    <span>Latency: </span>
                    <strong className="text-white">{src.latencyMs} ms</strong>
                  </div>
                  <div>
                    <span>Cadence: </span>
                    <strong className="text-white">{src.freshness}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bento-card p-4">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Immutable Administrative Audit Trail
              </h3>
              <p className="text-xs text-jatayu-secondary font-sans mt-0.5">
                Cryptographically verifiable timestamped record of every administrative action, alert creation, and facility verification.
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="px-3.5 py-1.5 bg-obsidian hover:bg-white/5 text-emerald-300 border border-white/10 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="bento-card overflow-x-auto p-0">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-obsidian/80 border-b border-white/10 text-emerald-400 font-mono text-[11px] uppercase">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Administrator</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Target Type & ID</th>
                  <th className="py-3 px-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-jatayu-muted whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-white">
                        {log.performedBy}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-emerald-300 text-[11px]">
                        {log.targetType}: {log.targetId}
                      </td>
                      <td className="py-2.5 px-4 text-jatayu-secondary max-w-md">
                        {log.details}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-jatayu-muted font-mono">
                      {isLoadingLogs ? 'Loading audit trail...' : 'No audit entries recorded.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE ALERT MODAL */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bento-card max-w-lg w-full p-6 space-y-4 shadow-2xl bg-charcoal/95 border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-bold text-white">
                  Publish Administrative Advisory Alert
                </h3>
              </div>
              <button
                onClick={() => setIsAlertModalOpen(false)}
                className="text-jatayu-muted hover:text-white text-lg font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-3 text-xs">
              <div>
                <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                  Alert Title:
                </label>
                <input
                  type="text"
                  required
                  value={newAlert.title}
                  onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
                  placeholder="e.g. Flash Flood Precautionary Advisory for Adyar Basin"
                  className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    Disaster Category:
                  </label>
                  <select
                    value={newAlert.category}
                    onChange={(e) => setNewAlert({ ...newAlert, category: e.target.value })}
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value="FLOOD">FLOOD</option>
                    <option value="CYCLONE">CYCLONE</option>
                    <option value="RAINFALL">HEAVY RAINFALL</option>
                    <option value="WIND">HIGH WIND</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    Severity Tier:
                  </label>
                  <select
                    value={newAlert.severity}
                    onChange={(e) => setNewAlert({ ...newAlert, severity: e.target.value as any })}
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ADVISORY">ADVISORY</option>
                    <option value="WATCH">WATCH</option>
                    <option value="WARNING">WARNING</option>
                    <option value="EMERGENCY">EMERGENCY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                  Affected Jurisdiction / Corridor:
                </label>
                <input
                  type="text"
                  required
                  value={newAlert.affectedArea}
                  onChange={(e) => setNewAlert({ ...newAlert, affectedArea: e.target.value })}
                  placeholder="e.g. Saidapet, Kotturpuram, and Velachery low-lying sectors"
                  className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                  Advisory Details & Public Guidance:
                </label>
                <textarea
                  required
                  rows={3}
                  value={newAlert.description}
                  onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })}
                  placeholder="State the observed localized risk, recommended precautions, and verification contact."
                  className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                  Validity Period:
                </label>
                <select
                  value={newAlert.expiresInHours}
                  onChange={(e) => setNewAlert({ ...newAlert, expiresInHours: parseInt(e.target.value, 10) })}
                  className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value={6}>6 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours</option>
                  <option value={48}>48 Hours</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAlertModalOpen(false)}
                  className="px-3.5 py-1.5 bg-obsidian hover:bg-white/5 text-jatayu-secondary hover:text-white border border-white/10 rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                >
                  Publish Advisory Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER FACILITY MODAL */}
      {isFacilityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bento-card max-w-lg w-full p-6 space-y-4 shadow-2xl bg-charcoal/95 border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Register Civil Defense Facility
                </h3>
              </div>
              <button
                onClick={() => setIsFacilityModalOpen(false)}
                className="text-jatayu-muted hover:text-white text-lg font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFacility} className="space-y-3 text-xs">
              <div>
                <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                  Facility Name:
                </label>
                <input
                  type="text"
                  required
                  value={newFacility.name}
                  onChange={(e) => setNewFacility({ ...newFacility, name: e.target.value })}
                  placeholder="e.g. Government Higher Secondary School Cyclone Shelter"
                  className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    Category:
                  </label>
                  <select
                    value={newFacility.category}
                    onChange={(e) => setNewFacility({ ...newFacility, category: e.target.value })}
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value="SHELTER">SHELTER</option>
                    <option value="HOSPITAL">HOSPITAL</option>
                    <option value="TRAUMA_CENTRE">TRAUMA CENTRE</option>
                    <option value="GOVT_SCHOOL_SHELTER">GOVT SCHOOL SHELTER</option>
                    <option value="AMBULANCE_SERVICE">AMBULANCE BASE</option>
                    <option value="EMERGENCY_OPS">EMERGENCY OPS CELL</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    Capacity (Persons):
                  </label>
                  <input
                    type="number"
                    value={newFacility.capacity}
                    onChange={(e) => setNewFacility({ ...newFacility, capacity: e.target.value })}
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    Latitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newFacility.latitude}
                    onChange={(e) => setNewFacility({ ...newFacility, latitude: e.target.value })}
                    placeholder="e.g. 13.0827"
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    Longitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newFacility.longitude}
                    onChange={(e) => setNewFacility({ ...newFacility, longitude: e.target.value })}
                    placeholder="e.g. 80.2707"
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                  Complete Address:
                </label>
                <input
                  type="text"
                  required
                  value={newFacility.address}
                  onChange={(e) => setNewFacility({ ...newFacility, address: e.target.value })}
                  placeholder="Street, locality, pin code"
                  className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    District:
                  </label>
                  <input
                    type="text"
                    required
                    value={newFacility.district}
                    onChange={(e) => setNewFacility({ ...newFacility, district: e.target.value })}
                    placeholder="e.g. Chennai"
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-sans focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                    Contact Phone:
                  </label>
                  <input
                    type="text"
                    value={newFacility.phone}
                    onChange={(e) => setNewFacility({ ...newFacility, phone: e.target.value })}
                    placeholder="Landline or helpline"
                    className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono font-semibold text-jatayu-muted uppercase mb-1">
                  Responsible Civil Authority:
                </label>
                <input
                  type="text"
                  value={newFacility.responsibleAuthority}
                  onChange={(e) => setNewFacility({ ...newFacility, responsibleAuthority: e.target.value })}
                  placeholder="e.g. Greater Chennai Corporation / Revenue Department"
                  className="w-full p-2.5 bg-obsidian/80 border border-white/10 rounded-xl text-jatayu-primary font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFacilityModalOpen(false)}
                  className="px-3.5 py-1.5 bg-obsidian hover:bg-white/5 text-jatayu-secondary hover:text-white border border-white/10 rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-mint text-slate-950 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(0,217,154,0.25)]"
                >
                  Register Facility Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
