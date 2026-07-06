import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import {
  LayoutDashboard, Package, PackagePlus, Users, Wrench, AlertTriangle,
  Warehouse, Key, BarChart2, Settings, LogOut, Bell, Moon, Sun,
  Menu, X, ChevronDown, Activity, ShieldCheck
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
  children?: { to: string; label: string }[];
}

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
  { to: '/assets', icon: <Package className="w-4 h-4" />, label: 'Assets', children: [
    { to: '/assets', label: 'Asset List' },
    { to: '/assets/add', label: 'Add Asset' },
  ]},
  { to: '/assignments', icon: <Users className="w-4 h-4" />, label: 'Assignments', roles: ['admin', 'it_staff'] },
  { to: '/maintenance', icon: <Wrench className="w-4 h-4" />, label: 'Maintenance / PPM', roles: ['admin', 'it_staff'] },
  { to: '/repairs', icon: <AlertTriangle className="w-4 h-4" />, label: 'Repairs', roles: ['admin', 'it_staff'] },
  { to: '/stock', icon: <Warehouse className="w-4 h-4" />, label: 'Stock', roles: ['admin', 'it_staff'] },
  { to: '/software', icon: <Key className="w-4 h-4" />, label: 'Software Licenses', roles: ['admin', 'it_staff'] },
  { to: '/reports', icon: <BarChart2 className="w-4 h-4" />, label: 'Reports' },
  { to: '/users', icon: <ShieldCheck className="w-4 h-4" />, label: 'Users', roles: ['admin'] },
  { to: '/activity', icon: <Activity className="w-4 h-4" />, label: 'Activity Log', roles: ['admin', 'it_staff'] },
  { to: '/settings', icon: <Settings className="w-4 h-4" />, label: 'Settings' },
];

export default function Layout() {
  const { currentUser, logout } = useAuth();
  const { darkMode, toggleDarkMode, notifications, notificationCount, markAllRead } = useAppContext();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>('/assets');
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const role = currentUser?.role || 'department_user';
  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(role));

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    it_staff: 'IT Staff',
    management: 'Management',
    department_user: 'Department User',
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`${mobile ? 'w-full' : sidebarOpen ? 'w-60' : 'w-16'} bg-slate-900 dark:bg-slate-950 text-white flex flex-col transition-all duration-200 shrink-0`}>
      <div className="h-16 flex items-center px-4 border-b border-slate-700/50">
        {(sidebarOpen || mobile) ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 32 32" className="w-5 h-5 text-white fill-current">
                <path d="M16 2L4 8v8c0 7.4 5.1 14.3 12 16 6.9-1.7 12-8.6 12-16V8L16 2z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Mountain Torq</div>
              <div className="text-xs text-slate-400 truncate">IT Asset System</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
            <svg viewBox="0 0 32 32" className="w-5 h-5 text-white fill-current">
              <path d="M16 2L4 8v8c0 7.4 5.1 14.3 12 16 6.9-1.7 12-8.6 12-16V8L16 2z"/>
            </svg>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map(item => {
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedNav === item.to;

          if (hasChildren && (sidebarOpen || mobile)) {
            return (
              <div key={item.to}>
                <button
                  onClick={() => setExpandedNav(isExpanded ? null : item.to)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
                    {item.children!.map(child => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === '/assets'}
                        onClick={() => mobile && setMobileOpen(false)}
                        className={({ isActive }) =>
                          `block py-1.5 px-2 rounded text-sm transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => mobile && setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
              title={!sidebarOpen && !mobile ? item.label : undefined}
            >
              {item.icon}
              {(sidebarOpen || mobile) && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-700/50 p-3">
        {(sidebarOpen || mobile) ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{currentUser?.name}</div>
              <div className="text-xs text-slate-400 truncate">{roleLabels[role]}</div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1 rounded" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={handleLogout} className="w-full flex items-center justify-center text-slate-400 hover:text-white py-1" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 shrink-0 shadow-sm">
          <button onClick={() => { setSidebarOpen(s => !s); setMobileOpen(s => !s); }} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <button onClick={toggleDarkMode} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(o => !o); if (!notifOpen) markAllRead(); }}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400"
            >
              <Bell className="w-4 h-4" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-medium">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Notifications</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-slate-400 text-sm">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <div>
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{n.title}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-slate-700 dark:text-white">{currentUser?.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{currentUser?.department}</div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
