import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AdminMessagePopup from './components/AdminMessagePopup';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import TeamPage from './pages/TeamPage';
import ProjectPage from './pages/ProjectPage';
import ProblemsPage from './pages/ProblemsPage';
import RulesPage from './pages/RulesPage';
import AdminPage from './pages/AdminPage';
import MentorDashboardPage from './pages/MentorDashboardPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster richColors position="top-right" closeButton duration={4000} />
        <ErrorBoundary>
          <BrowserRouter>
            <AdminMessagePopup />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
              <Route path="/project" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
              <Route path="/problems" element={<ProtectedRoute><ProblemsPage /></ProtectedRoute>} />
              <Route path="/rules" element={<ProtectedRoute><RulesPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>} />
              <Route path="/mentor" element={<ProtectedRoute requiredRole="mentor"><MentorDashboardPage /></ProtectedRoute>} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;


