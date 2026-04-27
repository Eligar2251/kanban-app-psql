import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import './LoginPage.css';

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !password.trim()) {
        setError('Email and password are required.');
        return;
      }
      setError('');
      setIsLoading(true);
      try {
        const data = await authService.signIn(email.trim(), password);
        if (data.user) {
          await fetchProfile(data.user.id);
        }
        navigate('/');
      } catch (err: any) {
        setError(err.message || 'Invalid credentials. Try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, navigate, fetchProfile]
  );

  return (
    <div className="auth-page dot-grid">
      <motion.div
        className="auth-card"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="auth-header">
          <div className="auth-logo">
            <span className="auth-logo-bracket">[</span>
            <span className="auth-logo-text">KANBAN</span>
            <span className="auth-logo-bracket">]</span>
          </div>
          <h1 className="auth-title">Sign In</h1>
          <p className="auth-subtitle">Access your workspace</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="auth-error">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={15} />}
            autoComplete="email"
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={15} />}
            autoComplete="current-password"
          />

          <div className="auth-forgot">
            <Link to="/forgot-password" className="auth-link">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <div className="auth-footer">
          <span className="auth-footer-text">No account?</span>
          <Link to="/register" className="auth-link">
            Create one
          </Link>
        </div>
      </motion.div>
    </div>
  );
}