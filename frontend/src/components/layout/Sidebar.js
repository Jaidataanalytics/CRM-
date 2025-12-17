import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Users,
  FileSpreadsheet,
  GitCompare,
  LineChart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'KPIs', roles: ['Admin', 'Manager', 'Employee'] },
  { path: '/charts', icon: BarChart3, label: 'Charts', roles: ['Admin', 'Manager', 'Employee'] },
  { path: '/insights', icon: TrendingUp, label: 'Insights', roles: ['Admin', 'Manager', 'Employee'] },
  { path: '/leads', icon: FileSpreadsheet, label: 'Manage Leads', roles: ['Admin', 'Manager', 'Employee'] },
  { path: '/comparison', icon: GitCompare, label: 'Comparison', roles: ['Admin', 'Manager', 'Employee'] },
  { path: '/forecast', icon: LineChart, label: 'Forecast', roles: ['Admin', 'Manager'] },
  { path: '/admin', icon: Settings, label: 'Admin', roles: ['Admin'] },
];

export const Sidebar = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleItems = menuItems.filter(item => 
    item.roles.some(role => hasRole(role))
  );

  return (
    <aside className={cn(
      "flex flex-col h-screen bg-slate-900 text-white transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!collapsed && (
          <h1 className="font-heading font-bold text-lg">LeadForge</h1>
        )}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {visibleItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800",
                  collapsed && "justify-center"
                )}
                title={item.label}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-slate-700">
        <div className={cn(
          "flex items-center gap-3",
          collapsed && "justify-center"
        )}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.picture} alt={user?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role}</p>
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size={collapsed ? "icon" : "sm"}
          onClick={handleLogout}
          className={cn(
            "mt-3 text-slate-400 hover:text-white hover:bg-slate-800",
            collapsed ? "w-full" : "w-full justify-start gap-2"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </aside>
  );
};
