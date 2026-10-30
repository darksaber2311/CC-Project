import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.jsx';
import { ProtectedRoute, AdminRoute } from './components/common/ProtectedRoute.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { DocumentsPage } from './pages/DocumentsPage.jsx';
import { UploadDocumentPage } from './pages/UploadDocumentPage.jsx';
import { DocumentDetailPage } from './pages/DocumentDetailPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { AlertDetailPage } from './pages/AlertDetailPage.jsx';
import { ActivityLogsPage } from './pages/ActivityLogsPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { EvaluationPage } from './pages/EvaluationPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { ForbiddenPage, NotFoundPage } from './pages/ErrorPages.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />

      {/* Protected Routes within App Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/:id" element={<DocumentDetailPage />} />
        <Route path="upload" element={<UploadDocumentPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* Administrator Only Routes */}
        <Route
          path="alerts"
          element={
            <AdminRoute>
              <AlertsPage />
            </AdminRoute>
          }
        />
        <Route
          path="alerts/:id"
          element={
            <AdminRoute>
              <AlertDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="activity"
          element={
            <AdminRoute>
              <ActivityLogsPage />
            </AdminRoute>
          }
        />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="evaluation"
          element={
            <AdminRoute>
              <EvaluationPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Error Routes */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
