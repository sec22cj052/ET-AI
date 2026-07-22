import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Ingestion from './pages/Ingestion';
import Copilot from './pages/Copilot';
import KnowledgeGraph from './pages/KnowledgeGraph';
import RCA from './pages/RCA';
import Compliance from './pages/Compliance';
import Lessons from './pages/Lessons';
import Verification from './pages/Verification';
import PlantManagerInbox from './pages/PlantManagerInbox';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/copilot" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={
          <Navigate to={user?.role === 'admin' ? "/admin" : "/copilot"} replace />
        } />
        
        {/* Admin only routes */}
        <Route path="admin" element={
          <ProtectedRoute requireAdmin>
            <Ingestion />
          </ProtectedRoute>
        } />
        <Route path="verification" element={
          <ProtectedRoute requireAdmin>
            <Verification />
          </ProtectedRoute>
        } />
        <Route path="plant-manager-inbox" element={
          <ProtectedRoute requireAdmin>
            <PlantManagerInbox />
          </ProtectedRoute>
        } />

        {/* Operator/All routes */}
        <Route path="copilot" element={<Copilot />} />
        <Route path="knowledge-graph" element={<KnowledgeGraph />} />
        <Route path="rca" element={<RCA />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="lessons" element={<Lessons />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
