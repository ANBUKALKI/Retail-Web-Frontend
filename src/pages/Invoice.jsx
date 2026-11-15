import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket';
import { useToast } from '../components/Toast.jsx';
import { catLabel, dt, money, SHOP_NAME, STATUS_LABEL } from '../util';

export default function Invoice() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/sales/${id}`)
      .then(({ data }) => setSale(data.sale))
      .catch((e) => setError(errMsg(e)));
  }, [id]);
  useEffect(load, [load]);
  useSocketEvent('sale:paid', load);

  async function act(path, body, okMsg) {
    setBusy(true);
    try {
      const { data } = await api.post(`/sales/${id}/${path}`, body);
      setSale(data.sale);
      toast.ok(okMsg);
    } catch (e) {
      toast.err(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!sale) return <p className="muted">Loading bill…</p>;

  const staffBilling = ['admin', 'billing'].includes(user.role);
  const pending = sale.status === 'PENDING_PAYMENT';

  return (
    <>
      <div className="row between wrap no-print">
        <Link to="/sales">← Back to bills</Link>
        <button className="btn" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>

      <section className="card invoice print-area">
        <div className="row between wrap">
          <div>
            <h2>{SHOP_NAME}</h2>
            <div className="muted">Tax invoice</div>
          </div>
          <div className="right">
            <strong>{sale.invoiceNo}</strong>
            <div>{dt(sale.createdAt)}</div>
            <span className={`badge st-${sale.status}`}>{STATUS_LABEL[sale.status]}</span>
          </div>
        </div>
        <p>
          <strong>Customer:</strong> {sale.customerName || (sale.customer && sale.customer.fullName) || 'Walk-in customer'}
          <br />
          <strong>Billed by:</strong> {sale.source === 'SELF' ? 'Self purchase' : sale.createdBy ? sale.createdBy.fullName : '—'}
          {sale.paymentMode && (
            <>
              <br />
              <strong>Payment:</strong> {sale.paymentMode.toUpperCase()} {sale.paidAt ? `on ${dt(sale.paidAt)}` : ''}
            </>
          )}
        </p>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Discount</th>
              <th className="num">Tax</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((i, idx) => (
              <tr key={idx}>
                <td>
                  {i.name}
                  <div className="muted small">
                    {i.sku} · {catLabel(i.category)}
                    {i.offerTitle ? ` · Offer: ${i.offerTitle}` : ''}
                  </div>
                  {i.codes.length > 0 && <div className="muted small">Item IDs: {i.codes.join(', ')}</div>}
                </td>
                <td className="num">{i.qty}</td>
                <td className="num">{money(i.unitPrice)}</td>
                <td className="num">{i.discount ? `− ${money(i.discount)}` : '—'}</td>
                <td className="num">
                  {money(i.taxAmount)} <span className="muted small">({i.taxPercent}%)</span>
                </td>
                <td className="num">{money(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div>
            <span>Subtotal</span>
            <span>{money(sale.subtotal)}</span>
          </div>
          <div>
            <span>Discount</span>
            <span>− {money(sale.discountTotal)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{money(sale.taxTotal)}</span>
          </div>
          <div className="grand">
            <span>Total</span>
            <span>{money(sale.grandTotal)}</span>
          </div>
        </div>

        {pending && sale.reservedUntil && <p className="notice">Items are reserved until {dt(sale.reservedUntil)}. Unpaid bills are released automatically.</p>}
        {sale.status === 'CANCELLED' && <p className="muted">Cancelled: {sale.cancelReason}</p>}
        {sale.status === 'REFUNDED' && (
          <p className="muted">
            Refunded on {dt(sale.refundedAt)}
            {sale.refundReason ? ` — ${sale.refundReason}` : ''}
          </p>
        )}
      </section>

      <div className="row wrap no-print">
        {pending && staffBilling && (
          <>
            <select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
            </select>
            <button className="btn btn-primary" disabled={busy} onClick={() => act('pay', { paymentMode: payMode }, 'Marked as paid.')}>
              Mark as paid
            </button>
          </>
        )}
        {pending && (staffBilling || user.role === 'user') && (
          <button className="btn" disabled={busy} onClick={() => window.confirm('Cancel this bill and release the items?') && act('cancel', {}, 'Bill cancelled.')}>
            Cancel bill
          </button>
        )}
        {sale.status === 'PAID' && staffBilling && (
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              const reason = window.prompt('Reason for refund (optional):');
              if (reason !== null) act('refund', { reason }, 'Bill refunded and stock restored.');
            }}
          >
            Refund
          </button>
        )}
        {sale.status === 'PAID' && user.role === 'user' && (
          <Link className="btn" to={`/feedback?sale=${sale._id}`}>
            Rate this purchase
          </Link>
        )}
      </div>
    </>
  );
}
