import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket';
import { useDebounced } from '../hooks';
import Pagination from '../components/Pagination.jsx';
import { dt, money, STATUS_LABEL } from '../util';

export default function Sales() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 25 });
  const [error, setError] = useState('');
  const dq = useDebounced(q);

  const load = useCallback(() => {
    const params = { page, q: dq || undefined, status: status || undefined };
    if (from) params.from = new Date(`${from}T00:00:00`).toISOString();
    if (to) params.to = new Date(`${to}T23:59:59.999`).toISOString();
    api
      .get('/sales', { params })
      .then(({ data: d }) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(errMsg(e)));
  }, [page, dq, status, from, to]);

  useEffect(load, [load]);
  useEffect(() => setPage(1), [dq, status, from, to]);
  useSocketEvent('sale:new', load);
  useSocketEvent('sale:paid', load);

  return (
    <>
      <h2>{user.role === 'user' ? 'My orders' : 'Sales & invoices'}</h2>
      <div className="filters card">
        <input placeholder="Invoice number" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Billed by</th>
              <th className="num">Total</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No bills found.
                </td>
              </tr>
            )}
            {data.items.map((s) => (
              <tr key={s._id} className="clickable" onClick={() => nav(`/sales/${s._id}`)}>
                <td>{s.invoiceNo}</td>
                <td>{dt(s.createdAt)}</td>
                <td>{s.customerName || (s.customer && s.customer.fullName) || 'Walk-in'}</td>
                <td>{s.source === 'SELF' ? 'Self purchase' : s.createdBy ? s.createdBy.fullName : '—'}</td>
                <td className="num">{money(s.grandTotal)}</td>
                <td>{s.paymentMode ? s.paymentMode.toUpperCase() : '—'}</td>
                <td>
                  <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />
    </>
  );
}
