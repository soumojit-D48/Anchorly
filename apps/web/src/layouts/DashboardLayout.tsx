import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { LayoutDashboard, Settings, LogOut, CheckSquare } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

export function DashboardLayout() {
  const { user, isLoading, logout, loginUrl } = useAuth();
  const location = useLocation();
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);

  // Set initial selected repo if any exist
  useEffect(() => {
    if (user && user.installations.length > 0 && !selectedRepoId) {
      const firstRepo = user.installations[0].repos[0];
      if (firstRepo) {
        setSelectedRepoId(firstRepo.id);
      }
    }
  }, [user, selectedRepoId]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading session...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-slate-100">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Contributor Confidence Coach</h1>
          <p className="text-slate-500 mb-8">Login to manage your repo settings and view stats.</p>
          <a
            href={loginUrl}
            className="inline-flex items-center justify-center w-full bg-slate-900 text-white font-medium px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Sign in with GitHub
          </a>
        </div>
      </div>
    );
  }

  const allRepos = user.installations.flatMap((ins) => ins.repos);
  const selectedRepo = allRepos.find((r) => r.id === selectedRepoId);

  const navItems = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Reviews', href: '/reviews', icon: CheckSquare },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Confidence Coach</h2>
        </div>

        <div className="p-4 border-b border-slate-200">
          <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
            Repository
          </label>
          <select
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
            value={selectedRepoId || ''}
            onChange={(e) => setSelectedRepoId(e.target.value)}
          >
            {allRepos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
            {allRepos.length === 0 && <option value="">No repos installed</option>}
          </select>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet context={{ selectedRepoId, selectedRepo }} />
        </div>
      </main>
    </div>
  );
}
