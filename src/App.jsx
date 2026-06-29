import React from 'react'
// Force HMR
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { AuthPage } from './pages/AuthPage'
import { AdminPage } from './pages/AdminPage'
import { DatabasePage } from './pages/database/DatabasePage'
import { TableViewer } from './pages/database/TableViewer'
import { FlashcardsPage } from './pages/tasks/FlashcardsPage'
import { RepetitiveFlashcardsPage } from './pages/tasks/RepetitiveFlashcardsPage'
import { RepetitiveHistoryPage } from './pages/admin/RepetitiveHistoryPage'
import { FleetCapPage } from './pages/admin/FleetCapPage'
import { DriverDashboardPage } from './pages/admin/DriverDashboardPage'
import { DashboardPage } from './pages/DashboardPage'
import { HowToWorkPage } from './pages/HowToWorkPage'
import { MainLayout } from './components/layout/MainLayout'
import { ApiWorkspacePage } from './pages/developer/ApiWorkspacePage'
import { ArchitecturePage } from './pages/developer/ArchitecturePage'

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="font-semibold text-slate-500">Loading...</p></div>;
  }

  if (!user || profile?.status === 'pending') {
    return <AuthPage forceView={profile?.status === 'pending' ? 'pending' : null} />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}



function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/how-to-work" element={
              <ProtectedRoute>
                <HowToWorkPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/repetitive-history" element={
              <ProtectedRoute requiredRole="admin">
                <RepetitiveHistoryPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/fleet-optimization" element={
              <ProtectedRoute requiredRole="admin">
                <FleetCapPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/driver-dashboard" element={
              <ProtectedRoute requiredRole="admin">
                <DriverDashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/developer/api-workspace" element={
              <ProtectedRoute requiredRole="admin">
                <ApiWorkspacePage />
              </ProtectedRoute>
            } />
            <Route path="/developer/architecture" element={
              <ProtectedRoute requiredRole="admin">
                <ArchitecturePage />
              </ProtectedRoute>
            } />
            <Route path="/database" element={
              <ProtectedRoute>
                <DatabasePage />
              </ProtectedRoute>
            } />
            <Route path="/database/:tableName" element={
              <ProtectedRoute>
                <TableViewer />
              </ProtectedRoute>
            } />
            <Route path="/tasks" element={
              <ProtectedRoute>
                <FlashcardsPage />
              </ProtectedRoute>
            } />
            <Route path="/repetitive-tasks" element={
              <ProtectedRoute>
                <RepetitiveFlashcardsPage />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App
