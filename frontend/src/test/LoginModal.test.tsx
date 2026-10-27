import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginModal } from '../components/auth/LoginModal';
import { AuthProvider } from '../context/AuthContext';

describe('LoginModal - Evaluator & Researcher Access', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders the local evaluator demo access quick-fill card on localhost', () => {
    render(
      <AuthProvider>
        <LoginModal isOpen={true} onClose={vi.fn()} />
      </AuthProvider>
    );

    expect(screen.getByText('LOCAL EVALUATOR DEMO ACCESS')).toBeInTheDocument();
    expect(screen.getByText('RESEARCHER')).toBeInTheDocument();
    expect(screen.getByText(/Quick Fill Demo Researcher/i)).toBeInTheDocument();
  });

  it('2. Clicking quick-fill populates qa_commander credentials into the input fields', () => {
    render(
      <AuthProvider>
        <LoginModal isOpen={true} onClose={vi.fn()} />
      </AuthProvider>
    );

    const quickFillBtn = screen.getByText(/Quick Fill Demo Researcher/i);
    fireEvent.click(quickFillBtn);

    const usernameInput = screen.getByPlaceholderText('e.g. command_officer') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('••••••••••••') as HTMLInputElement;

    expect(usernameInput.value).toBe('qa_commander');
    expect(passwordInput.value).toBe('JatayuResearcher2026!');
  });
});
