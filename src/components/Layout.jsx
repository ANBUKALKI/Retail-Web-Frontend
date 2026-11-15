import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  QrCode,
  Receipt,
  ScanLine,
  Star,
  Store,
  Tag,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket';
import { useToast } from './Toast.jsx';
import { ROLE_LABEL, SHOP_NAME } from '../util';

const ALL = ['admin', 'salesperson', 'billing', 'user'];

const NAV = [
  { to: '/', icon: LayoutDashboard, label: () => 'Dashboard', roles: ALL, end: true },
  { to: '/scan', icon: ScanLine, label: (r) => (r === 'user' ? 'Scan & Buy' : 'Scan & Bill'), roles: ALL },
  { to: '/sales', icon: Receipt, label: (r) => (r === 'user' ? 'My Orders' : 'Sales & Invoices'), roles: ALL },
  { to: '/products', icon: Package, label: () => 'Products', roles: ALL },
  { to: '/purchases', icon: Truck, label: () => 'Purchases', roles: ['admin', 'salesperson'] },
  { to: '/qr', icon: QrCode, label: () => 'QR Codes', roles: ['admin', 'salesperson'] },
  { to: '/offers', icon: Tag, label: () => 'Offers', roles: ALL },
  { to: '/chat', icon: MessageSquare, label: () => 'Chat', roles: ['admin', 'salesperson', 'user'] },
  { to: '/feedback', icon: Star, label: () => 'Feedback', roles: ALL },
  { to: '/reports', icon: TrendingUp, label: () => 'Reports', roles: ['admin', 'salesperson', 'billing'] },
  { to: '/users', icon: Users, label: () => 'Users', roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false); // phone: drawer open
  const [collapsed, setCollapsed] = useState(false); // desktop: slim icon bar

  const isPhone = () => window.matchMedia('(max-width: 820px)').matches;
  const toggleMenu = () => (isPhone() ? setOpen((o) => !o) : setCollapsed((c) => !c));

  // Live pushes from the server
  useSocketEvent('offer:new', (o) => toast.info(`New offer: ${o.title}`));
  useSocketEvent('sale:paid', (s) => toast.ok(`Payment received for ${s.invoiceNo}`));
  useSocketEvent('chat:message', () => {
    if (loc.pathname !== '/chat') toast.info('New chat message');
  });

  const initial = (user.fullName || user.username || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="app">
      <div className={`backdrop no-print ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar no-print ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand" title={SHOP_NAME}>
          <span className="brand-logo">
            <Store size={19} />
          </span>
          <span className="brand-name">{SHOP_NAME}</span>
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => {
            const Icon = n.icon;
            const text = n.label(user.role);
            return (
              <NavLink key={n.to} to={n.to} end={n.end} title={text} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon size={19} strokeWidth={1.9} />
                <span className="nav-label">{text}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="content">
        <header className="topbar no-print">
          <button className="btn btn-ghost menu-btn" onClick={toggleMenu} aria-label="Show or hide menu" title="Show or hide menu">
            <Menu size={22} />
          </button>
          <div className="spacer" />
          <div className="who">
            <span className="avatar" aria-hidden="true">
              {initial}
            </span>
            <strong>{user.fullName}</strong>
            <span className="badge">{ROLE_LABEL[user.role]}</span>
          </div>
          <button className="btn btn-icon" onClick={() => nav('/account')} title="Change password">
            <KeyRound size={16} />
            <span className="hide-sm">Password</span>
          </button>
          <button className="btn btn-icon" onClick={logout} title="Log out">
            <LogOut size={16} />
            <span className="hide-sm">Log out</span>
          </button>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}