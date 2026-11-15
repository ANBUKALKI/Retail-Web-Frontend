import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDebounced } from '../hooks';
import { money } from '../util';

/** Search-as-you-type product chooser. Results always come from the API. */
export default function ProductPicker({ onPick, placeholder = 'Search product by name, SKU or brand…', includeInactive = false }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    api
      .get('/products', { params: { q: dq, limit: 8, ...(includeInactive ? {} : { active: 'true' }) } })
      .then(({ data }) => !cancelled && setItems(data.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [dq, open, includeInactive]);

  return (
    <div className="picker">
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul className="picker-list">
          {items.length === 0 && <li className="muted">No products found</li>}
          {items.map((p) => (
            <li
              key={p._id}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(p);
                setQ('');
                setOpen(false);
              }}
            >
              <strong>{p.name}</strong>
              <span className="muted">
                {' '}
                {p.sku} · {money(p.price)} · stock {p.stockQty}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
