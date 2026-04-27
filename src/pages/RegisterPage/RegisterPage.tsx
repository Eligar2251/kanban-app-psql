import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { authService } from '../../services/auth.service';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import '../LoginPage/LoginPage.css';
import './RegisterPage.css';

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validate = useCallback(() => {
    if (!fullName.trim()) return 'Full name is required.';
    if (!email.trim()) return 'Email is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return '';
  }, [fullName, email, password, confirmPassword]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }
      setError('');
      setIsLoading(true);
      try {
        await authService.signUp(email.trim(), password, fullName.trim());
        setSuccess(true);
      } catch (err: any) {
        setError(err.message || 'Registration failed. Try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [validate, email, password, fullName]
  );

  if (success) {
    return (
      <div className="auth-page dot-grid">
        <motion.div
          className="auth-card"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="register-success">
            <CheckCircle size={40} className="register-success-icon" />
            <h2 className="register-success-title">Account Created</h2>
            <p className="register-success-text">
              Check your email to confirm your account, then sign in.
            </p>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/login')}
            >
              Go to Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

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
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Set up your workspace</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="auth-error">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User size={15} />}
            autoComplete="name"
            autoFocus
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={15} />}
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={15} />}
            autoComplete="new-password"
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<Lock size={15} />}
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
          >
            Create Account
          </Button>
        </form>

        <div className="auth-footer">
          <span className="auth-footer-text">Already have an account?</span>
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}