import { createBrowserRouter, Navigate } from 'react-router';
import ProtectedLayout from './components/ProtectedLayout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AssetList from './components/assets/AssetList';
import AssetForm from './components/assets/AssetForm';
import AssetDetail from './components/assets/AssetDetail';
import Assignments from './components/Assignments';
import Maintenance from './components/Maintenance';
import Repairs from './components/Repairs';
import Stock from './components/Stock';
import Software from './components/Software';
import Reports from './components/Reports';
import Users from './components/Users';
import Settings from './components/Settings';
import ActivityLog from './components/ActivityLog';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/',
    Component: ProtectedLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'assets', Component: AssetList },
      { path: 'assets/add', Component: AssetForm },
      { path: 'assets/:id', Component: AssetDetail },
      { path: 'assets/:id/edit', Component: AssetForm },
      { path: 'assignments', Component: Assignments },
      { path: 'maintenance', Component: Maintenance },
      { path: 'repairs', Component: Repairs },
      { path: 'stock', Component: Stock },
      { path: 'software', Component: Software },
      { path: 'reports', Component: Reports },
      { path: 'users', Component: Users },
      { path: 'activity', Component: ActivityLog },
      { path: 'settings', Component: Settings },
      { path: '*', Component: () => <Navigate to="/" replace /> },
    ],
  },
]);
