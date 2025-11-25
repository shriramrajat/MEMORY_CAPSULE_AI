import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Settings } from './Settings';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock the theme context
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({
    theme: 'auto',
    setTheme: vi.fn(),
    effectiveTheme: 'light',
  })),
}));

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({
      preferences: {
        theme: 'auto',
        notifications_enabled: false,
        email_notifications: false,
      },
    }),
  })),
  setDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/integrations/firebase/config', () => ({
  db: {},
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Settings Component', () => {
  const mockOnBack = vi.fn();
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: mockUser,
    });
  });

  it('should render settings page with title', async () => {
    render(<Settings onBack={mockOnBack} />);
    
    await waitFor(() => {
      const title = screen.getByText('Settings');
      expect(title).toBeTruthy();
    });
  });

  it('should render theme preference selector', async () => {
    render(<Settings onBack={mockOnBack} />);
    
    await waitFor(() => {
      const themeLabel = screen.getByText('Theme Preference');
      expect(themeLabel).toBeTruthy();
    });
  });

  it('should render notification settings toggles', async () => {
    render(<Settings onBack={mockOnBack} />);
    
    await waitFor(() => {
      const browserNotif = screen.getByText('Browser Notifications');
      const emailNotif = screen.getByText('Email Notifications');
      expect(browserNotif).toBeTruthy();
      expect(emailNotif).toBeTruthy();
    });
  });

  it('should render data export button', async () => {
    render(<Settings onBack={mockOnBack} />);
    
    await waitFor(() => {
      const exportButton = screen.getByText('Export All Data');
      expect(exportButton).toBeTruthy();
    });
  });

  it('should not render when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({
      user: null,
    });

    const { container } = render(<Settings onBack={mockOnBack} />);
    expect(container.firstChild).toBeNull();
  });
});
