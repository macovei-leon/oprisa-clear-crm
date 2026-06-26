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
import { MainLayout } from './components/layout/MainLayout'

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

function Dashboard() {
  const { profile } = useAuth();
  return (
    <MainLayout title="Dashboard" subtitle="Prezentare generală a asistenței și performanței">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Bine ai venit, {profile?.name || 'User'}!</h2>
        <p className="text-slate-600">Aceasta este pagina principală a Oprisa OPS. Panourile de control și statisticile vor fi afișate aici.</p>
      </div>
    </MainLayout>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
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
