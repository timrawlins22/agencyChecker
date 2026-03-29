import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PricingPage from './pages/PricingPage';
import ContactPage from './pages/ContactPage';
import DashboardPage from './pages/DashboardPage';
import CredentialsPage from './pages/CredentialsPage';
import MapperPage from './pages/MapperPage';
import PoliciesPage from './pages/PoliciesPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user && !localStorage.getItem('token')) return <Navigate to="/" replace />;

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (user || localStorage.getItem('token')) return <Navigate to="/dashboard" replace />;

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          <Route path="/pricing" element={
            <PublicRoute>
              <PricingPage />
            </PublicRoute>
          } />
          <Route path="/contact" element={
            <PublicRoute>
              <ContactPage />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/policies" element={
            <ProtectedRoute>
              <PoliciesPage />
            </ProtectedRoute>
          } />
          <Route path="/credentials" element={
            <ProtectedRoute>
              <CredentialsPage />
            </ProtectedRoute>
          } />
          <Route path="/mapper" element={
            <ProtectedRoute>
              <MapperPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
