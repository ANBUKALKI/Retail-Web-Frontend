import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import ProductPicker from '../components/ProductPicker.jsx';
import { CATEGORIES, catLabel, dt, money, toLocalInput } from '../util';

function OfferForm({ initial, onSaved, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(() => ({
    title: '',
    description: '',
    type: 'percent',
    value: '',
    category: '',
    validFrom: toLocalInput(),
    validTo: toLocalInput(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
    active: true,
    ...initial,
    products: (initial && initial.products) || [],
    ...(initial && initial._id ? { validFrom: toLocalInput(initial.validFrom), validTo: toLocalInput(initial.validTo) } : {}),
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        title: f.title,
        description: f.description,
        type: f.type,
        value: Number(f.value),
        category: f.category || '',
        products: f.products.map((p) => p._id),
        validFrom: new Date(f.validFrom).toISOString(),
        validTo: new Date(f.validTo).toISOString(),
        active: f.active,
      };
      if (f._id) await api.patch(`/offers/${f._id}`, body);
      else await api.post('/offers', body);
      toast.ok(f._id ? 'Offer updated.' : 'Offer announced to everyone online.');
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <label className="span2">
        Title
        <input value={f.title} onChange={(e) => set('title', e.target.value)} required />
      </label>
      <label className="span2">
        Description
        <textarea rows={2} value={f.description || ''} onChange={(e) => set('description', e.target.value)} />
      </label>
      <label>
        Discount type
        <select value={f.type} onChange={(e) => set('type', e.target.value)}>
          <option value="percent">Percentage off</option>
          <option value="flat">Flat amount off each item</option>
        </select>
      </label>
      <label>
        {f.type === 'percent' ? 'Percent (0–100)' : 'Amount'}
        <input type="number" min="0" max={f.type === 'percent' ? 100 : undefined} step="0.01" value={f.value} onChange={(e) => set('value', e.target.value)} required />
      </label>
      <label>
        Starts
        <input type="datetime-local" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} required />
      </label>
      <label>
        Ends
        <input type="datetime-local" value={f.validTo} onChange={(e) => set('validTo', e.target.value)} required />
      </label>
      <label className="span2">
        Applies to category (leave empty for everything)
        <select value={f.category || ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="span2">
        <span className="label-text">Or only these products (overrides category)</span>
        <ProductPicker onPick={(p) => !f.products.some((x) => x._id === p._id) && set('products', [...f.products, { _id: p._id, name: p.name }])} />
        <div>
          {f.products.map((p) => (
            <span key={p._id} className="chip">
              {p.name}{' '}
              <button type="button" className="chip-x" onClick={() => set('products', f.products.filter((x) => x._id !== p._id))} aria-label={`Remove ${p.name}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
      <label className="check span2">
        <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Active
      </label>
      {error && <p className="error span2">{error}</p>}
      <div className="row span2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save offer'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Offers() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => {
    api
      .get('/offers')
      .then(({ data }) => setItems(data.items))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);
  useSocketEvent('offer:new', load);

  async function remove(o) {
    if (!window.confirm(`Delete offer "${o.title}"?`)) return;
    try {
      await api.delete(`/offers/${o._id}`);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const now = Date.now();
  const state = (o) => (!o.active ? 'Off' : new Date(o.validFrom) > now ? 'Upcoming' : new Date(o.validTo) < now ? 'Ended' : 'Running');

  return (
    <>
      <div className="row between wrap">
        <h2>Offers</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setEdit({})}>
            + Announce offer
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">There are no offers right now.</p>}
      <div className="grid">
        {items.map((o) => (
          <article key={o._id} className="card offer">
            <div className="row between">
              <h3>{o.title}</h3>
              <span className={`badge ${state(o) === 'Running' ? 'st-PAID' : 'st-CANCELLED'}`}>{state(o)}</span>
            </div>
            <p className="offer-value">{o.type === 'percent' ? `${o.value}% off` : `${money(o.value)} off each item`}</p>
            {o.description && <p>{o.description}</p>}
            <p className="muted small">
              {o.products && o.products.length ? `Applies to: ${o.products.map((p) => p.name).join(', ')}` : `Applies to: ${o.category ? catLabel(o.category) : 'everything'}`}
              <br />
              {dt(o.validFrom)} → {dt(o.validTo)}
            </p>
            {isAdmin && (
              <div className="row">
                <button className="btn" onClick={() => setEdit(o)}>
                  Edit
                </button>
                <button className="btn btn-danger" onClick={() => remove(o)}>
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="muted small">Running offers are applied automatically at billing; the best matching offer per item is used.</p>

      {edit && (
        <Modal title={edit._id ? 'Edit offer' : 'Announce offer'} onClose={() => setEdit(null)} wide>
          <OfferForm
            initial={edit}
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
