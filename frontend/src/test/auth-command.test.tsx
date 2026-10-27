import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { AccessDeniedView } from '../components/command3d/AccessDeniedView';
import {
  getOperationalSectors,
  getDistrictTelemetry,
  getGlobeContext,
  CommandApiError,
} from '../services/command';

// Test consumer component for AuthContext inspection
const TestAuthConsumer: React.FC = () => {
  const { user, token, isAuthenticated, permissions, login, logout, invalidateSession, error } =
    useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-role">{user?.role || 'none'}</div>
      <div data-testid="user-name">{user?.username || 'none'}</div>
      <div data-testid="token-value">{token || 'no-token'}</div>
      <div data-testid="error-message">{error || 'no-error'}</div>
      <div data-testid="permissions">{permissions.join(',')}</div>

      <button
        data-testid="login-btn"
        onClick={() => {
          login('commander_raj', 'SecretPass123!').catch(() => {});
        }}
      >
        Login
      </button>

      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>

      <button
        data-testid="invalidate-btn"
        onClick={() => invalidateSession('Session expired by server (401)')}
      >
        Invalidate
      </button>
    </div>
  );
};

describe('1. React Authentication Context & Memory-Only Token Lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('initializes in an unauthenticated citizen state with empty memory tokens', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('user-role').textContent).toBe('none');
    expect(screen.getByTestId('token-value').textContent).toBe('no-token');

    // Verify memory-only constraint: browser storage must remain empty
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('performs login and stores token strictly in memory, never in browser storage', async () => {
    const mockToken = 'mocked.jwt.token.in.memory.only';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: mockToken,
        user: {
          id: 'user_123',
          username: 'commander_raj',
          displayName: 'Raj Commander',
          role: 'RESPONDER',
          roleVersion: 1,
          permissions: ['command:view_sectors', 'district:interrogate_telemetry'],
        },
      }),
    } as any);

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('login-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    expect(screen.getByTestId('user-role').textContent).toBe('RESPONDER');
    expect(screen.getByTestId('user-name').textContent).toBe('commander_raj');
    expect(screen.getByTestId('token-value').textContent).toBe(mockToken);
    expect(screen.getByTestId('permissions').textContent).toContain('command:view_sectors');

    // Strict Memory-Only Verification
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('handles login failure and keeps state unauthenticated', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid username or password' }),
    } as any);

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('login-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
      expect(screen.getByTestId('error-message').textContent).toContain('Invalid username');
    });

    expect(screen.getByTestId('token-value').textContent).toBe('no-token');
  });

  it('clears in-memory session on logout and calls backend logout endpoint', async () => {
    const mockToken = 'token.to.be.revoked';
    let logoutCalledWithToken = '';

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/login')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            token: mockToken,
            user: {
              id: 'user_123',
              username: 'commander_raj',
              role: 'RESPONDER',
              permissions: ['command:view_sectors'],
            },
          }),
        });
      }
      if (url.includes('/api/auth/logout')) {
        logoutCalledWithToken = (init?.headers as any)?.Authorization || '';
        return Promise.resolve({ ok: true, json: async () => ({ message: 'Logged out' }) });
      }
      return Promise.reject(new Error(`Unhandled url: ${url}`));
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    // Login first
    await act(async () => {
      fireEvent.click(screen.getByTestId('login-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    // Then logout
    await act(async () => {
      fireEvent.click(screen.getByTestId('logout-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    expect(screen.getByTestId('token-value').textContent).toBe('no-token');
    expect(logoutCalledWithToken).toBe(`Bearer ${mockToken}`);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('immediately invalidates session and sets reason message on 401', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('invalidate-btn'));
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('error-message').textContent).toBe('Session expired by server (401)');
  });
});

describe('2. Permission-Gated Navigation & UI Surfaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('hides 3D Command Globe in Sidebar for unauthenticated and citizen users', () => {
    render(
      <AuthProvider>
        <Sidebar activeTab="overview" onSelectTab={vi.fn()} />
      </AuthProvider>
    );

    expect(screen.queryByText('3D Command Globe')).toBeNull();
    expect(screen.getByText('Operational Overview')).toBeInTheDocument();
    expect(screen.getByText('Tactical Map')).toBeInTheDocument();
  });

  it('displays 3D Command Globe in Sidebar when user holds command3d:view_globe permission', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'researcher.token',
        user: {
          id: 'user_456',
          username: 'dr_meera',
          role: 'RESEARCHER',
          permissions: ['command:view_sectors', 'command3d:view_globe'],
        },
      }),
    } as any);

    const TestNavContainer = () => {
      const { login } = useAuth();
      return (
        <div>
          <button onClick={() => login('dr_meera', 'Pass123!')}>Login</button>
          <Sidebar activeTab="overview" onSelectTab={vi.fn()} />
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestNavContainer />
      </AuthProvider>
    );

    expect(screen.queryByText('3D Command Globe')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByText('3D Command Globe')).toBeInTheDocument();
    });
  });

  it('renders AccessDeniedView with explanation and return action when unauthorized', () => {
    const handleReturnToMap = vi.fn();
    const handleOpenLogin = vi.fn();

    render(
      <AuthProvider>
        <AccessDeniedView onReturnToMap={handleReturnToMap} onOpenLogin={handleOpenLogin} />
      </AuthProvider>
    );

    expect(screen.getByText('Tactical 3D Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/3D Command Globe requires verified operational credentials/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('RETURN TO 2D MAP'));
    expect(handleReturnToMap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('SIGN IN TO COMMAND'));
    expect(handleOpenLogin).toHaveBeenCalledTimes(1);
  });

  it('renders Topbar with COMMAND SIGN IN when unauthenticated and user badge when authenticated', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'admin.token',
        user: {
          id: 'admin_1',
          username: 'command_admin',
          displayName: 'Admin Officer',
          role: 'ADMIN',
          permissions: ['command3d:view_globe'],
        },
      }),
    } as any);

    const onOpenLogin = vi.fn();

    const TestTopbarContainer = () => {
      const { login } = useAuth();
      return (
        <div>
          <button data-testid="login-action" onClick={() => login('admin', 'pass')}>
            Simulate Login
          </button>
          <Topbar
            activeTab="overview"
            selectedLocation={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
            onSelectLocation={vi.fn()}
            onOpenLogin={onOpenLogin}
          />
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestTopbarContainer />
      </AuthProvider>
    );

    // Initial unauthenticated state
    expect(screen.getByText('COMMAND SIGN IN')).toBeInTheDocument();
    fireEvent.click(screen.getByText('COMMAND SIGN IN'));
    expect(onOpenLogin).toHaveBeenCalledTimes(1);

    // Authenticate
    await act(async () => {
      fireEvent.click(screen.getByTestId('login-action'));
    });

    await waitFor(() => {
      expect(screen.getByText('Admin Officer')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
      expect(screen.getByText('LOGOUT')).toBeInTheDocument();
    });
  });
});

describe('3. Protected Command API Client Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Bearer token to getOperationalSectors and returns verified sectors', async () => {
    let capturedAuth = '';
    global.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedAuth = (init?.headers as any)?.Authorization || '';
      return Promise.resolve({
        ok: true,
        json: async () => ({
          sectors: [
            {
              id: 'SEC-MUM-01',
              name: 'Mumbai Metropolitan Region',
              label: 'Mumbai Metro (West Coast)',
              coordinates: { lat: 19.076, lon: 72.8777 },
              status: 'ACTIVE_MONITORING',
              tacticalZone: 'WESTERN_COASTAL',
              coverage: 'Urban Coastal & Catchment',
              provenance: 'DataMeet Census 2011 & IMD Regional Meteorological Centre Mumbai',
            },
          ],
          count: 1,
          telemetryTimestamp: '2026-10-25T00:00:00Z',
          requestedBy: { userId: 'u1', role: 'RESPONDER' },
        }),
      });
    });

    const res = await getOperationalSectors('test.bearer.token');

    expect(capturedAuth).toBe('Bearer test.bearer.token');
    expect(res.sectors).toHaveLength(1);
    expect(res.sectors[0].name).toBe('Mumbai Metropolitan Region');
    expect(res.sectors[0].provenance).toContain('Census 2011');
  });

  it('attaches Bearer token to getDistrictTelemetry with validated coordinates', async () => {
    let capturedUrl = '';
    let capturedAuth = '';
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedAuth = (init?.headers as any)?.Authorization || '';
      return Promise.resolve({
        ok: true,
        json: async () => ({
          telemetryTimestamp: '2026-10-25T00:00:00Z',
          query: { lat: 19.076, lon: 72.8777 },
          operator: { userId: 'u1', role: 'RESPONDER' },
          district: {
            canonicalDistrict: 'MUMBAI',
            canonicalState: 'MAHARASHTRA',
            matchStatus: 'RESOLVED_DISTRICT',
            datasetSource: 'DataMeet Census 2011',
            vintage: '2011 Census',
          },
        }),
      });
    });

    const res = await getDistrictTelemetry(19.076, 72.8777, 'test.token');

    expect(capturedUrl).toContain('lat=19.076');
    expect(capturedUrl).toContain('lon=72.8777');
    expect(capturedAuth).toBe('Bearer test.token');
    expect(res.district.canonicalDistrict).toBe('MUMBAI');
  });

  it('attaches Bearer token to getGlobeContext and handles 403 Forbidden with CommandApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: "Access denied. Role 'RESPONDER' lacks required capability 'command3d:view_globe'.",
        code: 'FORBIDDEN',
      }),
    } as any);

    await expect(getGlobeContext('responder.token')).rejects.toThrow(CommandApiError);

    try {
      await getGlobeContext('responder.token');
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toContain('command3d:view_globe');
    }
  });

  it('throws 401 CommandApiError immediately when token is missing', async () => {
    await expect(getOperationalSectors('')).rejects.toThrow(/Missing Bearer token/);
  });
});
