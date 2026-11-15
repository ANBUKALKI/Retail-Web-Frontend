import { useState } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';

export default function ChangePassword({ forced }) {
  const { refresh, logout } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) return setError('The two new passwords do not match.');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.ok('Password updated.');
      setCurrent('');
      setNew('');
      setConfirm('');
      await refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form className="card login" onSubmit={submit}>
      <h2>{forced ? 'Choose your own password' : 'Change password'}</h2>
      {forced && <p className="muted">Your account was created by the administrator. Please set a new password before continuing.</p>}
      <label>
        Current password
        <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label>
        New password (at least 8 characters)
        <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        Confirm new password
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        {forced && (
          <button type="button" className="btn" onClick={logout}>
            Log out
          </button>
        )}
      </div>
    </form>
  );

  return forced ? <div className="center-screen">{form}</div> : form;
}
