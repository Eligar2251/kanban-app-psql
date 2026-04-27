import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSupabaseReconnect } from './hooks/useSupabaseReconnect';
import DevSwitcher from './components/DevSwitcher/DevSwitcher';

import './App.css';

const LoginPage = React.lazy(() => import('./pages/LoginPage/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage/ForgotPasswordPage'));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage/ProjectsPage'));
const BoardPage = React.lazy(() => import('./pages/BoardPage/BoardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage/ProfilePage'));
const WorkspacePage = React.lazy(() => import('./pages/WorkspacePage/WorkspacePage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized, isLoading } = useAuthStore();

  if (!isInitialized || isLoading) {
    return (
      <div className="app-loading">
        <span className="app-loading-text">INITIALIZING...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized, isLoading } = useAuthStore();

  if (!isInitialized || isLoading) {
    return (
      <div className="app-loading">
        <span className="app-loading-text">INITIALIZING...</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="app-loading">
      <span className="app-loading-text">LOADING...</span>
    </div>
  );
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useSupabaseReconnect();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id"
            element={
              <ProtectedRoute>
                <BoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Dev account switcher — only visible on localhost */}
      <DevSwitcher />
    </BrowserRouter>
  );
}