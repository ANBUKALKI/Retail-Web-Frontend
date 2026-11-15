import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Purchases from './pages/Purchases.jsx';
import Scan from './pages/Scan.jsx';
import Sales from './pages/Sales.jsx';
import Invoice from './pages/Invoice.jsx';
import QrCodes from './pages/QrCodes.jsx';
import Offers from './pages/Offers.jsx';
import Chat from './pages/Chat.jsx';
import Feedback from './pages/Feedback.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Accounts created by an admin must choose their own password first.
  if (user.mustChangePassword) return <ChangePassword forced />;
  return <Outlet />;
}

function Guard({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="scan" element={<Scan />} />
          <Route path="sales" element={<Sales />} />
          <Route path="sales/:id" element={<Invoice />} />
          <Route path="products" element={<Products />} />
          <Route
            path="purchases"
            element={
              <Guard roles={['admin', 'salesperson']}>
                <Purchases />
              </Guard>
            }
          />
          <Route
            path="qr"
            element={
              <Guard roles={['admin', 'salesperson']}>
                <QrCodes />
              </Guard>
            }
          />
          <Route path="offers" element={<Offers />} />
          <Route
            path="chat"
            element={
              <Guard roles={['admin', 'salesperson', 'user']}>
                <Chat />
              </Guard>
            }
          />
          <Route path="feedback" element={<Feedback />} />
          <Route
            path="reports"
            element={
              <Guard roles={['admin', 'salesperson', 'billing']}>
                <Reports />
              </Guard>
            }
          />
          <Route
            path="users"
            element={
              <Guard roles={['admin']}>
                <Users />
              </Guard>
            }
          />
          <Route path="account" element={<ChangePassword />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
