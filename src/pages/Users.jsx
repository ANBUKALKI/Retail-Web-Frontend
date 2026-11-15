import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useDebounced } from '../hooks';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { dt, randomPassword, ROLE_LABEL, ROLES } from '../util';

function CreateForm({ onSaved, onClose }) {
  const [f, setF] = useState({ username: '', fullName: '', role: 'salesperson', phone: '', password: randomPassword() });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/users', f);
      setDone(f);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <p className="notice ok">Account created. Give these details to the user. They will be asked to choose their own password at first login.</p>
        <p>
          <strong>Username:</strong> {done.username.toLowerCase()}
          <br />
          <strong>Password:</strong> {done.password}
          <br />
          <strong>Role:</strong> {ROLE_LABEL[done.role]}
        </p>
        <p className="muted small">This password is not shown again.</p>
        <button className="btn btn-primary" onClick={onSaved}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <label>
        Username
        <input value={f.username} onChange={(e) => set('username', e.target.value)} minLength={3} required autoFocus />
      </label>
      <label>
        Full name
        <input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required />
      </label>
      <label>
        Role
        <select value={f.role} onChange={(e) => set('role', e.target.value)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Phone (optional)
        <input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
      </label>
      <label className="span2">
        Temporary password
        <div className="row">
          <input value={f.password} onChange={(e) => set('password', e.target.value)} minLength={8} required />
          <button type="button" className="btn" onClick={() => set('password', randomPassword())}>
            Generate
          </button>
        </div>
      </label>
      {error && <p className="error span2">{error}</p>}
      <div className="row span2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditForm({ target, isSelf, onSaved, onClose }) {
  const toast = useToast();
  const [f, setF] = useState({ fullName: target.fullName, phone: target.phone || '', role: target.role, active: target.active });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api.patch(`/users/${target._id}`, f);
      toast.ok('User updated.');
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function reset() {
    setError('');
    try {
      await api.post(`/users/${target._id}/reset-password`, { password });
      toast.ok('Password reset. The user must change it at next login.');
      setPassword('');
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <>
      <form onSubmit={save} className="form-grid">
        <p className="span2 muted">
          Username: <strong>{target.username}</strong>
        </p>
        <label>
          Full name
          <input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required />
        </label>
        <label>
          Phone
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label>
          Role
          <select value={f.role} onChange={(e) => set('role', e.target.value)} disabled={isSelf}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} disabled={isSelf} /> Account enabled
        </label>
        <div className="row span2">
          <button className="btn btn-primary">Save changes</button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
      <hr />
      <h4>Reset password</h4>
      <div className="row">
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New temporary password (8+ characters)" />
        <button type="button" className="btn" onClick={() => setPassword(randomPassword())}>
          Generate
        </button>
        <button type="button" className="btn btn-danger" disabled={password.length < 8} onClick={reset}>
          Reset
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}

export default function Users() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 50 });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [edit, setEdit] = useState(null);
  const dq = useDebounced(q);

  const load = useCallback(() => {
    api
      .get('/users', { params: { page, q: dq || undefined, role: role || undefined } })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(errMsg(e)));
  }, [page, dq, role]);
  useEffect(load, [load]);
  useEffect(() => setPage(1), [dq, role]);

  return (
    <>
      <div className="row between wrap">
        <h2>Users</h2>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Create account
        </button>
      </div>
      <p className="muted">There is no self sign-up. Only you can create accounts, and each one gets a username, a temporary password and a role.</p>
      <div className="filters card">
        <input placeholder="Search username or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u._id} className={u.active ? '' : 'dim'}>
                <td>{u.username}</td>
                <td>{u.fullName}</td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>
                  <span className={`badge ${u.active ? 'st-PAID' : 'st-CANCELLED'}`}>{u.active ? 'Enabled' : 'Disabled'}</span>
                </td>
                <td>{u.lastLoginAt ? dt(u.lastLoginAt) : 'Never'}</td>
                <td className="actions">
                  <button className="btn" onClick={() => setEdit(u)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />

      {creating && (
        <Modal title="Create account" onClose={() => setCreating(false)}>
          <CreateForm
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              load();
            }}
          />
        </Modal>
      )}
      {edit && (
        <Modal title={`Manage ${edit.fullName}`} onClose={() => setEdit(null)}>
          <EditForm
            target={edit}
            isSelf={edit._id === user._id}
            onClose={() => setEdit(null)}
            onSaved={() => {
              setEdit(null);
              load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
