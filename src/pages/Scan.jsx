import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import Scanner from '../components/Scanner.jsx';
import { money, STAFF, STATUS_LABEL, uuid } from '../util';

const lineQty = (l) => l.loose + l.codes.length;

/**
 * Scan & Bill (staff) / Scan & Buy (customers).
 * The cart only lives on this device. Stock is claimed atomically on the server when the bill is created,
 * so many people can scan the same item at once and the server decides who gets it.
 */
export default function Scan() {
  const { user } = useAuth();
  const toast = useToast();
  const isStaff = STAFF.includes(user.role);

  const [cart, setCart] = useState([]);
  const cartRef = useRef([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  // One id per cart. If the network drops and the person taps again, the server returns the same bill, not a second one.
  const requestId = useRef(uuid());

  function commit(next) {
    cartRef.current = next;
    setCart(next);
  }

  async function handleScan(text) {
    if (busy) return;
    setResult(null);
    try {
      const { data } = await api.post('/qr/resolve', { text });
      const { product, kind, code } = data;
      const cur = cartRef.current;
      const idx = cur.findIndex((l) => l.product._id === product._id);
      const line = idx >= 0 ? cur[idx] : { product, loose: 0, codes: [], allowLoose: false };

      if (kind === 'unit' && cur.some((l) => l.codes.includes(code))) {
        return toast.info('That item is already in the cart.');
      }
      if (lineQty(line) + 1 > product.stockQty) {
        return toast.err(`Only ${product.stockQty} of "${product.name}" in stock.`);
      }
      const updated =
        kind === 'unit'
          ? { ...line, product, codes: [...line.codes, code] }
          : { ...line, product, loose: line.loose + 1, allowLoose: true };
      commit(idx >= 0 ? cur.map((l, i) => (i === idx ? updated : l)) : [...cur, updated]);
      toast.ok(`Added ${product.name}`);
    } catch (e) {
      toast.err(errMsg(e));
    }
  }

  function setLoose(pid, value) {
    commit(
      cartRef.current.map((l) => {
        if (l.product._id !== pid) return l;
        const max = l.product.stockQty - l.codes.length;
        const v = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
        return { ...l, loose: v };
      })
    );
  }

  function removeCode(pid, code) {
    commit(cartRef.current.map((l) => (l.product._id === pid ? { ...l, codes: l.codes.filter((c) => c !== code) } : l)).filter((l) => lineQty(l) > 0 || l.allowLoose));
  }

  const removeLine = (pid) => commit(cartRef.current.filter((l) => l.product._id !== pid));
  const valid = cart.filter((l) => lineQty(l) > 0);
  const estimate = valid.reduce((s, l) => s + l.product.price * lineQty(l) * (1 + (l.product.taxPercent || 0) / 100), 0);

  async function checkout() {
    setError('');
    setBusy(true);
    try {
      const body = {
        clientRequestId: requestId.current,
        items: valid.map((l) => ({ productId: l.product._id, qty: l.loose, codes: l.codes })),
      };
      if (isStaff) {
        body.paymentMode = paymentMode;
        body.customerName = customerName || undefined;
      }
      const { data } = await api.post('/sales', body);
      setResult(data.sale);
      commit([]);
      setCustomerName('');
      requestId.current = uuid(); // next cart gets a fresh id
    } catch (e) {
      // Same id is kept on purpose so that a retry after a network error cannot create two bills.
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>{isStaff ? 'Scan & Bill' : 'Scan & Buy'}</h2>
      <div className="grid two align-start">
        <section className="card">
          <h3>Scan items</h3>
          <Scanner onScan={handleScan} />
        </section>

        <section className="card">
          <h3>Cart</h3>
          {result && (
            <div className="notice ok">
              <strong>Bill {result.invoiceNo} created</strong> · {money(result.grandTotal)} · {STATUS_LABEL[result.status]}
              {result.status === 'PENDING_PAYMENT' && <div>Please pay at the billing counter. Your items are held for you.</div>}
              <div>
                <Link to={`/sales/${result._id}`}>Open bill</Link>
              </div>
            </div>
          )}
          {valid.length === 0 && !result && <p className="muted">Scan a product QR code to start.</p>}
          {cart.map((l) => (
            <div key={l.product._id} className="cart-line">
              <div className="grow">
                <strong>{l.product.name}</strong>
                <div className="muted small">
                  {l.product.sku} · {money(l.product.price)} each
                </div>
                {l.codes.map((c) => (
                  <span key={c} className="chip">
                    {c}{' '}
                    <button className="chip-x" onClick={() => removeCode(l.product._id, c)} aria-label={`Remove ${c}`}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="cart-qty">
                {l.allowLoose && (
                  <input
                    type="number"
                    min="0"
                    max={l.product.stockQty - l.codes.length}
                    value={l.loose}
                    onChange={(e) => setLoose(l.product._id, e.target.value)}
                    aria-label={`Quantity of ${l.product.name}`}
                  />
                )}
                <span className="muted small">× {lineQty(l)}</span>
                {l.allowLoose && (
                  <button className="btn btn-ghost" onClick={() => removeLine(l.product._id)} aria-label="Remove line">
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {valid.length > 0 && (
            <>
              <p className="total-line">
                Estimated total: {money(estimate)}
                <span className="muted small"> — offers and final tax are applied by the server when the bill is created.</span>
              </p>
              {isStaff && (
                <div className="form-grid">
                  <label>
                    Customer name (optional)
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </label>
                  <label>
                    Payment mode
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                    </select>
                  </label>
                </div>
              )}
              {!isStaff && <p className="muted small">Your items will be reserved for a short time. Pay at the billing counter to complete the purchase.</p>}
              {error && <p className="error">{error}</p>}
              <div className="row">
                <button className="btn btn-primary" onClick={checkout} disabled={busy}>
                  {busy ? 'Creating bill…' : isStaff ? 'Create bill' : 'Place order'}
                </button>
                <button className="btn" onClick={() => commit([])} disabled={busy}>
                  Clear
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
