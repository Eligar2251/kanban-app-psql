import React, { useState, useCallback, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import Header from '../../components/Header/Header';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Avatar from '../../components/Avatar/Avatar';
import './ProfilePage.css';

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function ProfilePage() {
  const { user, profile, fetchProfile } = useAuthStore();

  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile?.full_name]);

  const handleProfileSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!fullName.trim()) {
        setProfileError('Name is required.');
        return;
      }
      setProfileError('');
      setProfileSuccess('');
      setProfileLoading(true);
      try {
        await authService.updateProfile(user!.id, { full_name: fullName.trim() });
        await fetchProfile(user!.id);
        setProfileSuccess('Profile updated successfully.');
        setTimeout(() => setProfileSuccess(''), 3000);
      } catch (err: any) {
        setProfileError(err.message || 'Failed to update profile.');
      } finally {
        setProfileLoading(false);
      }
    },
    [fullName, user, fetchProfile]
  );

  const handlePasswordChange = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPassword || newPassword.length < 6) {
        setPasswordError('Password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match.');
        return;
      }
      setPasswordError('');
      setPasswordSuccess('');
      setPasswordLoading(true);
      try {
        await authService.updatePassword(newPassword);
        setPasswordSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 3000);
      } catch (err: any) {
        setPasswordError(err.message || 'Failed to change password.');
      } finally {
        setPasswordLoading(false);
      }
    },
    [newPassword, confirmPassword]
  );

  const displayName = profile?.full_name || profile?.email || 'User';

  return (
    <div className="profile-page">
      <Header breadcrumbs={[{ label: 'Profile' }]} />

      <div className="profile-content dot-grid">
        <motion.div
          className="profile-container"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Profile header */}
          <div className="profile-hero">
            <Avatar name={displayName} userId={user?.id} size="lg" />
            <div className="profile-hero-info">
              <h1 className="profile-hero-name">{displayName}</h1>
              <span className="profile-hero-email">{profile?.email}</span>
            </div>
          </div>

          <div className="profile-sections">
            {/* Profile info section */}
            <section className="profile-section">
              <div className="profile-section-header">
                <h2 className="profile-section-title">
                  <User size={14} />
                  Profile Info
                </h2>
              </div>
              <form
                className="profile-form"
                onSubmit={handleProfileSave}
                noValidate
              >
                {profileError && (
                  <div className="profile-alert profile-alert--error">
                    <AlertCircle size={13} />
                    <span>{profileError}</span>
                  </div>
                )}
                {profileSuccess && (
                  <div className="profile-alert profile-alert--success">
                    <CheckCircle size={13} />
                    <span>{profileSuccess}</span>
                  </div>
                )}

                <Input
                  label="Full Name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  icon={<User size={15} />}
                  placeholder="Your full name"
                />

                <Input
                  label="Email"
                  type="email"
                  value={profile?.email || ''}
                  icon={<Mail size={15} />}
                  disabled
                  hint="Email cannot be changed"
                />

                <div className="profile-form-actions">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={<Save size={13} />}
                    loading={profileLoading}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </section>

            {/* Password section */}
            <section className="profile-section">
              <div className="profile-section-header">
                <h2 className="profile-section-title">
                  <Lock size={14} />
                  Change Password
                </h2>
              </div>
              <form
                className="profile-form"
                onSubmit={handlePasswordChange}
                noValidate
              >
                {passwordError && (
                  <div className="profile-alert profile-alert--error">
                    <AlertCircle size={13} />
                    <span>{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="profile-alert profile-alert--success">
                    <CheckCircle size={13} />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <Input
                  label="New Password"
                  type="password"
                  placeholder="min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={<Lock size={15} />}
                  autoComplete="new-password"
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={<Lock size={15} />}
                  autoComplete="new-password"
                />

                <div className="profile-form-actions">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={<Lock size={13} />}
                    loading={passwordLoading}
                  >
                    Change Password
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}