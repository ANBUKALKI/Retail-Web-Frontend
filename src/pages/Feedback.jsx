import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import Pagination from '../components/Pagination.jsx';
import { dt } from '../util';

const Stars = ({ n }) => (
  <span aria-label={`${n} out of 5`} className="stars">
    {'★'.repeat(n)}
    {'☆'.repeat(5 - n)}
  </span>
);

export default function Feedback() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const saleId = params.get('sale') || undefined;
  const seesAll = ['admin', 'billing'].includes(user.role);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 25, summary: { average: 0, distribution: [] } });

  const load = useCallback(() => {
    api
      .get('/feedback', { params: { page } })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(errMsg(e)));
  }, [page]);
  useEffect(load, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/feedback', { rating, comment, saleId });
      toast.ok('Thank you for your feedback!');
      setComment('');
      setRating(5);
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Feedback</h2>
      <form className="card" onSubmit={submit}>
        <h3>{saleId ? 'Rate your purchase' : 'Share your feedback'}</h3>
        <div className="row" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} className={`star-btn ${n <= rating ? 'on' : ''}`} onClick={() => setRating(n)} aria-label={`${n} stars`} aria-pressed={n === rating}>
              ★
            </button>
          ))}
        </div>
        <label>
          Comment (optional)
          <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Submit feedback'}
        </button>
      </form>

      <section className="card">
        <div className="row between wrap">
          <h3>{seesAll ? 'All feedback' : 'Your feedback'}</h3>
          {data.total > 0 && (
            <span>
              Average rating: <strong>{data.summary.average}</strong> / 5 ({data.total})
            </span>
          )}
        </div>
        {data.items.length === 0 && <p className="muted">No feedback yet.</p>}
        {data.items.map((f) => (
          <div key={f._id} className="list-item">
            <div className="row between">
              <Stars n={f.rating} />
              <span className="muted small">{dt(f.createdAt)}</span>
            </div>
            {f.comment && <p>{f.comment}</p>}
            <div className="muted small">
              {seesAll && f.user ? `${f.user.fullName} · ` : ''}
              {f.sale ? `Bill ${f.sale.invoiceNo}` : ''}
            </div>
          </div>
        ))}
        <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />
      </section>
    </>
  );
}
