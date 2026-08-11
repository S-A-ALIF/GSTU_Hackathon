import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute — wraps pages that require authentication.
 * @param {object} props
 * @param {React.ReactNode} props.children - The page component to render if authorized.
 * @param {string} [props.requiredRole] - Optional role restriction ('admin', 'mentor').
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser } = useAuth();

  // Not logged in → redirect to landing
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // Role restriction check
  if (requiredRole && currentUser.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
