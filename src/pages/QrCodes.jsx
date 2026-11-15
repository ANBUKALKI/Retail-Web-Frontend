import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import ProductPicker from '../components/ProductPicker.jsx';
import { catLabel, dt, money } from '../util';

function Label({ item, product }) {
  return (
    <div className="qr-label">
      <QRCodeSVG value={item.text} size={132} level="M" marginSize={1} />
      <div className="qr-name">{product.name}</div>
      <div className="qr-meta">
        {product.brand ? `${product.brand} · ` : ''}
        {money(product.price)}
      </div>
      <div className="qr-code">{item.code}</div>
    </div>
  );
}

export default function QrCodes() {
  const { user } = useAuth();
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const [kind, setKind] = useState('unit');
  const [count, setCount] = useState(1);
  const [batch, setBatch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(null);

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, limit: 50 });
  const [shown, setShown] = useState(null);

  const loadList = useCallback(() => {
    api
      .get('/qr', { params: { page, status: status || undefined } })
      .then(({ data }) => setList(data))
      .catch((e) => setError(errMsg(e)));
  }, [page, status]);
  useEffect(loadList, [loadList]);
  useEffect(() => setPage(1), [status]);

  async function generate(e) {
    e.preventDefault();
    if (!product) return setError('Choose a product first.');
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/qr/generate', { productId: product._id, kind, count: Number(count), batch: batch || undefined });
      setGenerated(data);
      toast.ok(`${data.items.length} QR code(s) created.`);
      loadList();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function show(q) {
    try {
      const { data } = await api.get(`/qr/${q._id}/text`);
      setShown({ item: { code: data.code, text: data.text }, product: data.product });
    } catch (err) {
      toast.err(errMsg(err));
    }
  }

  async function voidCode(q) {
    if (!window.confirm(`Void ${q.code}? It can no longer be sold.`)) return;
    try {
      await api.post(`/qr/${q._id}/void`);
      loadList();
    } catch (err) {
      toast.err(errMsg(err));
    }
  }

  return (
    <>
      <h2 className="no-print">QR codes</h2>

      <form className="card no-print" onSubmit={generate}>
        <h3>Generate QR labels</h3>
        <p className="muted small">
          Each label carries the product details and its own individual ID. “One per item” labels (clothes, tools) can be sold once. “Product label” (loose goods such as groceries) is reusable and the quantity is chosen when scanning.
        </p>
        <div className="form-grid">
          <div className="span2">
            <span className="label-text">Product</span>
            <ProductPicker onPick={setProduct} />
            {product && (
              <p>
                Selected: <strong>{product.name}</strong> <span className="muted">({product.sku} · {catLabel(product.category)} · {money(product.price)})</span>
              </p>
            )}
          </div>
          <label>
            Label type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="unit">One per item (unique ID each)</option>
              <option value="product">Product label (reusable)</option>
            </select>
          </label>
          {kind === 'unit' && (
            <label>
              How many labels
              <input type="number" min="1" max="500" value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
          )}
          <label>
            Batch (optional)
            <input value={batch} onChange={(e) => setBatch(e.target.value)} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </form>

      {generated && (
        <section className="card print-area">
          <div className="row between wrap no-print">
            <h3>New labels ({generated.items.length})</h3>
            <button className="btn" onClick={() => window.print()}>
              Print labels
            </button>
          </div>
          <div className="qr-grid">
            {generated.items.map((it) => (
              <Label key={it.code} item={it} product={generated.product} />
            ))}
          </div>
        </section>
      )}

      <section className="card table-wrap no-print">
        <div className="row between wrap">
          <h3>All QR codes</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="AVAILABLE">Available</option>
            <option value="SOLD">Sold</option>
            <option value="VOID">Void</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Product</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No QR codes yet.
                </td>
              </tr>
            )}
            {list.items.map((q) => (
              <tr key={q._id}>
                <td>{q.code}</td>
                <td>{q.product ? q.product.name : '—'}</td>
                <td>{q.kind === 'unit' ? 'Single item' : 'Product label'}</td>
                <td>
                  <span className={`badge ${q.status === 'AVAILABLE' ? 'st-PAID' : q.status === 'SOLD' ? 'st-PENDING_PAYMENT' : 'st-CANCELLED'}`}>{q.status}</span>
                </td>
                <td>{dt(q.createdAt)}</td>
                <td className="actions">
                  <button className="btn" onClick={() => show(q)}>
                    Show
                  </button>
                  {user.role === 'admin' && q.status === 'AVAILABLE' && (
                    <button className="btn btn-danger" onClick={() => voidCode(q)}>
                      Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} limit={list.limit} total={list.total} onChange={setPage} />
      </section>

      {shown && (
        <Modal title={shown.product.name} onClose={() => setShown(null)}>
          <div className="center">
            <Label item={shown.item} product={shown.product} />
          </div>
        </Modal>
      )}
    </>
  );
}
