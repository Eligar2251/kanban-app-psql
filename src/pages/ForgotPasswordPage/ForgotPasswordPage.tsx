import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { authService } from '../../services/auth.service';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import '../LoginPage/LoginPage.css';
import './ForgotPasswordPage.css';

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) {
        setError('Email is required.');
        return;
      }
      setError('');
      setIsLoading(true);
      try {
        await authService.resetPassword(email.trim());
        setSuccess(true);
      } catch (err: any) {
        setError(err.message || 'Failed to send reset email.');
      } finally {
        setIsLoading(false);
      }
    },
    [email]
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
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">We'll send a recovery link</p>
        </div>

        {success ? (
          <div className="forgot-success">
            <CheckCircle size={36} className="forgot-success-icon" />
            <p className="forgot-success-text">
              Recovery link sent to <strong>{email}</strong>. Check your inbox.
            </p>
            <Link to="/login" className="auth-link">
              <ArrowLeft size={12} />
              Back to Sign In
            </Link>
          </div>
        ) : (
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
            >
              Send Reset Link
            </Button>

            <div className="forgot-back">
              <Link to="/login" className="auth-link">
                <ArrowLeft size={12} />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}