import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { catLabel, downloadCsv, money, toDateInput } from '../util';

function Summary({ items }) {
  return (
    <div className="grid">
      {items.map(([label, value]) => (
        <div key={label} className="card stat">
          <span className="muted">{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function Table({ title, head, rows, empty = 'No data for this period.' }) {
  return (
    <section className="card table-wrap">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className={h.startsWith('#') ? 'num' : ''}>
                {h.replace(/^#/, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={head[j].startsWith('#') ? 'num' : ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const tabs = ['sales', ...(isAdmin ? ['purchases', 'profit'] : []), 'stock'];
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() - 29 * 24 * 3600 * 1000)));
  const [to, setTo] = useState(toDateInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setData(null);
    setError('');
    const params = {
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59.999`).toISOString(),
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    };
    api
      .get(`/reports/${tab}`, { params })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(errMsg(e)));
  }, [tab, from, to]);
  useEffect(load, [load]);

  function exportCsv() {
    if (!data) return;
    const name = `${tab}-report-${from}_to_${to}.csv`;
    if (tab === 'sales') downloadCsv(name, data.byDay.map((d) => ({ date: d._id, bills: d.bills, revenue: d.revenue })));
    else if (tab === 'purchases') downloadCsv(name, data.byDay.map((d) => ({ date: d._id, spent: d.spent })));
    else if (tab === 'profit') downloadCsv(name, data.byCategory.map((d) => ({ category: d._id, revenue: d.revenue, cost: d.cost, profit: d.profit })));
    else downloadCsv(name, data.items.map(({ _id, low, ...rest }) => ({ ...rest, low: low ? 'yes' : 'no' })));
  }

  return (
    <>
      <div className="row between wrap no-print">
        <h2>Reports</h2>
        <div className="row">
          <button className="btn" onClick={exportCsv} disabled={!data}>
            Export CSV
          </button>
          <button className="btn" onClick={() => window.print()} disabled={!data}>
            Print
          </button>
        </div>
      </div>

      <div className="tabs no-print">
        {tabs.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab !== 'stock' && (
        <div className="filters card no-print">
          <label>
            From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading report…</p>}

      <div className="print-area">
        {data && tab === 'sales' && (
          <>
            {user.role === 'salesperson' && <p className="muted">Showing your own bills only.</p>}
            <Summary
              items={[
                ['Revenue (incl. tax)', money(data.totals.revenue)],
                ['Paid bills', data.totals.bills],
                ['Discounts given', money(data.totals.discount)],
                ['Tax collected', money(data.totals.tax)],
              ]}
            />
            <Table title="Revenue by day" head={['Date', '#Bills', '#Revenue']} rows={data.byDay.map((d) => [d._id, d.bills, money(d.revenue)])} />
            <div className="grid two">
              <Table title="By category" head={['Category', '#Qty', '#Revenue']} rows={data.byCategory.map((d) => [catLabel(d._id), d.qty, money(d.revenue)])} />
              <Table title="By payment mode" head={['Mode', '#Bills', '#Revenue']} rows={data.byPayment.map((d) => [(d._id || '—').toUpperCase(), d.bills, money(d.revenue)])} />
            </div>
            <Table title="Top products" head={['Product', 'SKU', '#Qty', '#Revenue']} rows={data.byProduct.map((d) => [d._id.name, d._id.sku, d.qty, money(d.revenue)])} />
            {user.role !== 'salesperson' && (
              <Table title="By salesperson / biller" head={['Name', '#Bills', '#Revenue']} rows={data.bySalesperson.map((d) => [d.name || '—', d.bills, money(d.revenue)])} />
            )}
          </>
        )}

        {data && tab === 'purchases' && (
          <>
            <Summary items={[['Total spent', money(data.totals.spent)], ['Purchases', data.totals.purchases]]} />
            <Table title="Spend by supplier" head={['Supplier', '#Purchases', '#Spent']} rows={data.bySupplier.map((d) => [d._id, d.purchases, money(d.spent)])} />
            <Table title="Spend by day" head={['Date', '#Spent']} rows={data.byDay.map((d) => [d._id, money(d.spent)])} />
          </>
        )}

        {data && tab === 'profit' && (
          <>
            <Summary
              items={[
                ['Revenue (excl. tax)', money(data.totals.revenue)],
                ['Cost of goods sold', money(data.totals.cost)],
                ['Profit', money(data.totals.profit)],
              ]}
            />
            <Table title="Profit by category" head={['Category', '#Revenue', '#Cost', '#Profit']} rows={data.byCategory.map((d) => [catLabel(d._id), money(d.revenue), money(d.cost), money(d.profit)])} />
            <p className="muted small">Cost uses the cost price saved on each bill line at the time of sale.</p>
          </>
        )}

        {data && tab === 'stock' && (
          <>
            <Summary
              items={[
                ['Active products', data.totals.products],
                ['Low or out of stock', data.totals.low],
                ...(isAdmin ? [['Stock value (at cost)', money(data.totals.stockValue)]] : []),
              ]}
            />
            <Table
              title="Stock on hand"
              head={['SKU', 'Product', 'Category', '#In stock', '#Alert at', ...(isAdmin ? ['#Value'] : [])]}
              rows={data.items.map((p) => [p.sku, p.name, catLabel(p.category), p.low ? `${p.stockQty} ⚠` : p.stockQty, p.lowStockLevel, ...(isAdmin ? [money(p.stockValue)] : [])])}
            />
          </>
        )}
      </div>
    </>
  );
}
