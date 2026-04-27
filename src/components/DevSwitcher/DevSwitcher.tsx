import React, { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronUp, ChevronDown, Loader2, Check, Zap } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../Avatar/Avatar';
import './DevSwitcher.css';

/**
 * Configure your test accounts here.
 * These accounts must already exist in your Supabase auth.
 */
const DEV_ACCOUNTS = [
  {
    id: 'owner',
    label: 'Owner / Lead',
    email: 'pakin.vm@mail.ru',
    password: 'Pakin2002$',
    name: 'Vadim Savichev',
    role: 'OWNER',
    color: '#C8FF00',
  },
  {
    id: 'editor',
    label: 'Editor',
    email: 'pakin.vm2@mail.ru',
    password: 'Pakin2002$',
    name: 'Pakl',
    role: 'EDITOR',
    color: '#00B4D8',
  },
  {
    id: 'viewer',
    label: 'Viewer',
    email: 'viewer@test.com',
    password: 'test123456',
    name: 'Max Viewer',
    role: 'VIEWER',
    color: '#5A5A72',
  },
];

const DevSwitcher = memo(function DevSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { user, fetchProfile } = useAuthStore();

  // Only show in development
  const isDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const currentEmail = user?.email?.toLowerCase();

  const handleSwitch = useCallback(
    async (account: (typeof DEV_ACCOUNTS)[0]) => {
      if (switching) return;
      if (currentEmail === account.email.toLowerCase()) return;

      setError('');
      setSwitching(account.id);

      try {
        // Sign out current user
        await authService.signOut();

        // Sign in as new user
        const data = await authService.signIn(account.email, account.password);
        if (data.user) {
          await fetchProfile(data.user.id);
        }

        setIsOpen(false);
      } catch (err: any) {
        console.error('Account switch failed:', err);
        setError(
          err.message?.includes('Invalid')
            ? `Account ${account.email} not found. Create it first.`
            : err.message || 'Switch failed'
        );
      } finally {
        setSwitching(null);
      }
    },
    [switching, currentEmail, fetchProfile]
  );

  const handleCreateAccounts = useCallback(async () => {
    setError('');
    setSwitching('creating');

    for (const account of DEV_ACCOUNTS) {
      try {
        await authService.signUp(account.email, account.password, account.name);
      } catch (err: any) {
        // Ignore "already registered" errors
        if (!err.message?.includes('already') && !err.message?.includes('exists')) {
          console.warn(`Failed to create ${account.email}:`, err.message);
        }
      }
    }

    setSwitching(null);
    setError('Accounts created! You may need to confirm emails in Supabase dashboard if email confirmation is enabled.');
  }, []);

  if (!isDev) return null;

  return (
    <div className="dev-switcher">
      <button
        className={`dev-switcher-toggle ${isOpen ? 'dev-switcher-toggle--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Dev Account Switcher"
      >
        <Zap size={12} />
        <span className="dev-switcher-toggle-label">DEV</span>
        {isOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="dev-switcher-panel"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <div className="dev-switcher-header">
              <Users size={12} />
              <span>QUICK SWITCH</span>
            </div>

            {error && (
              <div className="dev-switcher-error">{error}</div>
            )}

            <div className="dev-switcher-list">
              {DEV_ACCOUNTS.map((account) => {
                const isCurrent = currentEmail === account.email.toLowerCase();
                const isLoading = switching === account.id;

                return (
                  <button
                    key={account.id}
                    className={`dev-switcher-account ${
                      isCurrent ? 'dev-switcher-account--active' : ''
                    }`}
                    onClick={() => handleSwitch(account)}
                    disabled={isCurrent || switching !== null}
                    style={{ '--account-color': account.color } as React.CSSProperties}
                  >
                    <Avatar name={account.name} size="sm" />
                    <div className="dev-switcher-account-info">
                      <span className="dev-switcher-account-name">
                        {account.name}
                      </span>
                      <span className="dev-switcher-account-meta">
                        {account.email}
                        <span
                          className="dev-switcher-account-role"
                          style={{ color: account.color }}
                        >
                          {account.role}
                        </span>
                      </span>
                    </div>
                    <div className="dev-switcher-account-status">
                      {isLoading && <Loader2 size={13} className="dev-switcher-spinner" />}
                      {isCurrent && <Check size={13} className="dev-switcher-check" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="dev-switcher-footer">
              <button
                className="dev-switcher-create-btn"
                onClick={handleCreateAccounts}
                disabled={switching !== null}
              >
                {switching === 'creating' ? (
                  <Loader2 size={11} className="dev-switcher-spinner" />
                ) : (
                  <Plus size={11} />
                )}
                Create test accounts
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Need Plus icon
import { Plus } from 'lucide-react';

export default DevSwitcher;