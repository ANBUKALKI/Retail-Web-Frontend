import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import ProductPicker from '../components/ProductPicker.jsx';
import { dOnly, money, toDateInput } from '../util';

function PurchaseForm({ onSaved, onClose }) {
  const toast = useToast();
  const [supplier, setSupplier] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [purchaseDate, setDate] = useState(toDateInput());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addProduct = (p) =>
    setLines((ls) =>
      ls.some((l) => l.productId === p._id) ? ls : [...ls, { productId: p._id, name: p.name, sku: p.sku, qty: 1, costPrice: p.costPrice ?? 0, batch: '', expiryDate: '' }]
    );
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.costPrice || 0), 0);

  async function submit(e) {
    e.preventDefault();
    if (!lines.length) return setError('Add at least one product.');
    setBusy(true);
    setError('');
    try {
      await api.post('/purchases', {
        supplier,
        invoiceRef: invoiceRef || undefined,
        notes: notes || undefined,
        purchaseDate,
        items: lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          costPrice: Number(l.costPrice),
          batch: l.batch || undefined,
          expiryDate: l.expiryDate || undefined,
        })),
      });
      toast.ok('Purchase recorded and stock updated.');
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <label>
          Supplier
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} required />
        </label>
        <label>
          Supplier invoice no.
          <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
        </label>
        <label>
          Date
          <input type="date" value={purchaseDate} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <h4>Items</h4>
      <ProductPicker onPick={addProduct} />
      {lines.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Cost each</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.productId}>
                  <td>
                    {l.name}
                    <div className="muted small">{l.sku}</div>
                  </td>
                  <td>
                    <input className="w80" type="number" min="1" step="1" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} required />
                  </td>
                  <td>
                    <input className="w100" type="number" min="0" step="0.01" value={l.costPrice} onChange={(e) => setLine(i, 'costPrice', e.target.value)} required />
                  </td>
                  <td>
                    <input className="w100" value={l.batch} onChange={(e) => setLine(i, 'batch', e.target.value)} />
                  </td>
                  <td>
                    <input type="date" value={l.expiryDate} onChange={(e) => setLine(i, 'expiryDate', e.target.value)} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="total-line">Total cost: {money(total)}</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save purchase'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Purchases() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 25 });
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState(null);

  const load = useCallback(() => {
    api
      .get('/purchases', { params: { page } })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(errMsg(e)));
  }, [page]);
  useEffect(load, [load]);

  return (
    <>
      <div className="row between wrap">
        <h2>Purchase details</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            + Record purchase
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Invoice ref</th>
              <th className="num">Items</th>
              {isAdmin && <th className="num">Total</th>}
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No purchases recorded yet.
                </td>
              </tr>
            )}
            {data.items.map((p) => (
              <tr key={p._id} className="clickable" onClick={() => setView(p)}>
                <td>{dOnly(p.purchaseDate)}</td>
                <td>{p.supplier}</td>
                <td>{p.invoiceRef || '—'}</td>
                <td className="num">{p.items.length}</td>
                {isAdmin && <td className="num">{money(p.total)}</td>}
                <td>{p.createdBy ? p.createdBy.fullName : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />

      {adding && (
        <Modal title="Record purchase" onClose={() => setAdding(false)} wide>
          <PurchaseForm
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              load();
            }}
          />
        </Modal>
      )}
      {view && (
        <Modal title={`Purchase from ${view.supplier}`} onClose={() => setView(null)} wide>
          <p className="muted">
            {dOnly(view.purchaseDate)} · Ref {view.invoiceRef || '—'}
          </p>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Qty</th>
                {isAdmin && <th className="num">Cost each</th>}
                <th>Batch</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((i, idx) => (
                <tr key={idx}>
                  <td>
                    {i.name} <span className="muted small">{i.sku}</span>
                  </td>
                  <td className="num">{i.qty}</td>
                  {isAdmin && <td className="num">{money(i.costPrice)}</td>}
                  <td>{i.batch || '—'}</td>
                  <td>{i.expiryDate ? dOnly(i.expiryDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {isAdmin && <p className="total-line">Total: {money(view.total)}</p>}
          {view.notes && <p className="muted">{view.notes}</p>}
        </Modal>
      )}
    </>
  );
}
