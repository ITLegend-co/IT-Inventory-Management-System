import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

export default function ProtectedLayout() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}
