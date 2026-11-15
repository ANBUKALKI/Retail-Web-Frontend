import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket';
import { useDebounced } from '../hooks';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { ATTR_FIELDS, CATEGORIES, catLabel, money } from '../util';

const EMPTY = {
  sku: '',
  name: '',
  category: 'clothes',
  brand: '',
  unit: 'pcs',
  price: '',
  costPrice: '',
  taxPercent: 0,
  lowStockLevel: 5,
  description: '',
  attributes: {},
  active: true,
};

function ProductForm({ initial, role, onSaved, onClose }) {
  const toast = useToast();
  const [f, setF] = useState({ ...EMPTY, ...initial, attributes: { ...(initial && initial.attributes) } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...f, price: Number(f.price), taxPercent: Number(f.taxPercent), lowStockLevel: Number(f.lowStockLevel) };
      if (role === 'admin') body.costPrice = Number(f.costPrice || 0);
      else delete body.costPrice;
      delete body.stockQty;
      if (f._id) await api.patch(`/products/${f._id}`, body);
      else await api.post('/products', body);
      toast.ok('Product saved.');
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <label>
        SKU
        <input value={f.sku} onChange={(e) => set('sku', e.target.value)} required />
      </label>
      <label>
        Name
        <input value={f.name} onChange={(e) => set('name', e.target.value)} required />
      </label>
      <label>
        Category
        <select value={f.category} onChange={(e) => set('category', e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Brand
        <input value={f.brand || ''} onChange={(e) => set('brand', e.target.value)} />
      </label>
      <label>
        Selling price
        <input type="number" min="0" step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} required />
      </label>
      {role === 'admin' && (
        <label>
          Cost price (updated by purchases)
          <input type="number" min="0" step="0.01" value={f.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
        </label>
      )}
      <label>
        Tax % (added on top of price)
        <input type="number" min="0" max="100" step="0.01" value={f.taxPercent} onChange={(e) => set('taxPercent', e.target.value)} />
      </label>
      <label>
        Unit
        <input value={f.unit} onChange={(e) => set('unit', e.target.value)} />
      </label>
      <label>
        Low stock alert at
        <input type="number" min="0" value={f.lowStockLevel} onChange={(e) => set('lowStockLevel', e.target.value)} />
      </label>
      {ATTR_FIELDS[f.category].map((a) => (
        <label key={a.key}>
          {a.label}
          <input value={f.attributes[a.key] || ''} onChange={(e) => set('attributes', { ...f.attributes, [a.key]: e.target.value })} />
        </label>
      ))}
      <label className="span2">
        Description
        <textarea rows={2} value={f.description || ''} onChange={(e) => set('description', e.target.value)} />
      </label>
      <label className="check span2">
        <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Available for sale
      </label>
      {error && <p className="error span2">{error}</p>}
      <div className="row span2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AdjustForm({ product, onSaved, onClose }) {
  const toast = useToast();
  const [delta, setDelta] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/products/${product._id}/adjust`, { delta: Number(delta) });
      toast.ok('Stock adjusted.');
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <form onSubmit={submit}>
      <p>
        <strong>{product.name}</strong> currently has <strong>{product.stockQty}</strong> in stock.
      </p>
      <label>
        Add or remove (use a minus sign to remove, e.g. -2)
        <input type="number" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} required autoFocus />
      </label>
      <p className="muted small">For new stock arriving from a supplier, record a purchase instead so cost and batch are kept.</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary">Apply</button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Products() {
  const { user } = useAuth();
  const canEdit = ['admin', 'salesperson'].includes(user.role);
  const isAdmin = user.role === 'admin';
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [low, setLow] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 25 });
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [adjust, setAdjust] = useState(null);
  const dq = useDebounced(q);

  const load = useCallback(() => {
    const params = { page, q: dq || undefined, category: category || undefined, low: low || undefined };
    if (canEdit && !showInactive) params.active = 'true';
    api
      .get('/products', { params })
      .then(({ data: d }) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(errMsg(e)));
  }, [page, dq, category, low, showInactive, canEdit]);

  useEffect(load, [load]);
  useEffect(() => setPage(1), [dq, category, low, showInactive]);
  useSocketEvent('stock:changed', load);

  async function deactivate(p) {
    if (!window.confirm(`Stop selling "${p.name}"? Past bills keep their records.`)) return;
    try {
      await api.delete(`/products/${p._id}`);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <>
      <div className="row between wrap">
        <h2>Products</h2>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setEdit({})}>
            + New product
          </button>
        )}
      </div>

      <div className="filters card">
        <input placeholder="Search name, SKU or brand" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {canEdit && (
          <label className="check">
            <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Low stock only
          </label>
        )}
        {canEdit && (
          <label className="check">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Include stopped items
          </label>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Category</th>
              <th className="num">Price</th>
              {isAdmin && <th className="num">Cost</th>}
              <th className="num">Tax</th>
              <th className="num">Stock</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  No products found.
                </td>
              </tr>
            )}
            {data.items.map((p) => (
              <tr key={p._id} className={p.active ? '' : 'dim'}>
                <td>{p.sku}</td>
                <td>
                  <strong>{p.name}</strong>
                  <div className="muted small">
                    {[p.brand, ...Object.values(p.attributes || {})].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td>{catLabel(p.category)}</td>
                <td className="num">{money(p.price)}</td>
                {isAdmin && <td className="num">{money(p.costPrice)}</td>}
                <td className="num">{p.taxPercent}%</td>
                <td className="num">
                  <span className={`badge ${p.stockQty === 0 ? 'st-CANCELLED' : p.stockQty <= p.lowStockLevel ? 'st-PENDING_PAYMENT' : 'st-PAID'}`}>
                    {p.stockQty} {p.unit}
                  </span>
                </td>
                {canEdit && (
                  <td className="actions">
                    <button className="btn" onClick={() => setEdit(p)}>
                      Edit
                    </button>
                    {isAdmin && (
                      <button className="btn" onClick={() => setAdjust(p)}>
                        Stock
                      </button>
                    )}
                    {isAdmin && p.active && (
                      <button className="btn btn-danger" onClick={() => deactivate(p)}>
                        Stop
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />

      {edit && (
        <Modal title={edit._id ? 'Edit product' : 'New product'} onClose={() => setEdit(null)} wide>
          <ProductForm
            initial={edit}
            role={user.role}
            onClose={() => setEdit(null)}
            onSaved={() => {
              setEdit(null);
              load();
            }}
          />
        </Modal>
      )}
      {adjust && (
        <Modal title="Adjust stock" onClose={() => setAdjust(null)}>
          <AdjustForm
            product={adjust}
            onClose={() => setAdjust(null)}
            onSaved={() => {
              setAdjust(null);
              load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
