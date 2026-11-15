import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket';
import { catLabel, dOnly, dt, money, startOfToday, STATUS_LABEL } from '../util';

function Stat({ label, value, hint }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}

function Bars({ data }) {
  if (!data.length) return <p className="muted">No sales in the last 7 days.</p>;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <div className="bars">
      {data.map((d) => (
        <div key={d.date} className="bar-col" title={`${d.date}: ${money(d.revenue)} (${d.bills} bills)`}>
          <span className="bar-val">{money(d.revenue)}</span>
          <div className="bar" style={{ height: `${Math.max(4, (d.revenue / max) * 100)}%` }} />
          <span className="muted small">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/dashboard', { params: { from: startOfToday().toISOString() } })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(load, [load]);
  useSocketEvent('sale:new', load);
  useSocketEvent('stock:changed', load);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  if (user.role === 'user') {
    return (
      <>
        <h2>Welcome, {user.fullName}</h2>
        <div className="grid">
          <Stat label="Bills awaiting payment" value={data.pendingPayments} hint="Pay at the billing counter" />
          <Stat label="Offers running now" value={data.offers.length} />
        </div>
        <div className="grid two">
          <section className="card">
            <div className="row between">
              <h3>Recent orders</h3>
              <Link to="/sales">View all</Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <p className="muted">You have not bought anything yet. Try “Scan & Buy”.</p>
            ) : (
              <table>
                <tbody>
                  {data.recentOrders.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <Link to={`/sales/${s._id}`}>{s.invoiceNo}</Link>
                      </td>
                      <td>{dt(s.createdAt)}</td>
                      <td>{money(s.grandTotal)}</td>
                      <td>
                        <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="card">
            <div className="row between">
              <h3>Offers</h3>
              <Link to="/offers">All offers</Link>
            </div>
            {data.offers.length === 0 ? (
              <p className="muted">No offers are running right now.</p>
            ) : (
              data.offers.map((o) => (
                <div key={o._id} className="list-item">
                  <strong>{o.title}</strong>
                  <div className="muted small">Ends {dOnly(o.validTo)}</div>
                </div>
              ))
            )}
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <h2>Dashboard</h2>
      <div className="grid">
        <Stat label="Today's revenue" value={money(data.today.revenue)} hint={user.role === 'salesperson' ? 'Your bills only' : undefined} />
        <Stat label="Bills today" value={data.today.bills} />
        <Stat label="Awaiting payment" value={data.pendingPayments} hint="Customer self-purchases" />
        <Stat label="Low stock items" value={data.lowStock.length} />
        {data.counts && <Stat label="Active products" value={data.counts.products} />}
        {data.counts && <Stat label="Active users" value={data.counts.users} />}
      </div>

      <section className="card">
        <h3>Revenue, last 7 days</h3>
        <Bars data={data.last7Days} />
      </section>

      <div className="grid two">
        <section className="card">
          <h3>Top products (30 days)</h3>
          {data.topProducts.length === 0 ? (
            <p className="muted">No sales yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((t) => (
                  <tr key={t.sku}>
                    <td>{t.name}</td>
                    <td className="num">{t.qty}</td>
                    <td className="num">{money(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h3>Low stock</h3>
          {data.lowStock.length === 0 ? (
            <p className="muted">All products are above their stock alert level.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="num">Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td>{catLabel(p.category)}</td>
                    <td className="num">
                      <span className={`badge ${p.stockQty === 0 ? 'st-CANCELLED' : 'st-PENDING_PAYMENT'}`}>{p.stockQty}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {data.expiring && (
        <section className="card">
          <h3>Expiring within 30 days</h3>
          {data.expiring.length === 0 ? (
            <p className="muted">Nothing in stock is about to expire.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th className="num">In stock</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring.map((e, i) => (
                  <tr key={`${e.sku}-${e.batch}-${i}`}>
                    <td>{e.name}</td>
                    <td>{e.batch || '—'}</td>
                    <td>{dOnly(e.expiryDate)}</td>
                    <td className="num">{e.stockQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
