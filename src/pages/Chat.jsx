import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket';
import { dt, ROLE_LABEL } from '../util';

export default function Chat() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const activeRef = useRef(null);
  const bottom = useRef(null);
  activeRef.current = active;

  const loadContacts = useCallback(() => {
    api
      .get('/chat/contacts')
      .then(({ data }) => setContacts(data.items))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(loadContacts, [loadContacts]);

  useEffect(() => {
    if (!active) return;
    api
      .get(`/chat/history/${active._id}`)
      .then(({ data }) => setMessages(data.items))
      .catch((e) => setError(errMsg(e)));
    api.post(`/chat/read/${active._id}`).then(loadContacts).catch(() => {});
  }, [active, loadContacts]);

  useEffect(() => {
    bottom.current && bottom.current.scrollIntoView({ block: 'end' });
  }, [messages]);

  useSocketEvent('chat:message', (m) => {
    const cur = activeRef.current;
    if (cur && m.from === cur._id) {
      setMessages((ms) => (ms.some((x) => x._id === m._id) ? ms : [...ms, m]));
      api.post(`/chat/read/${cur._id}`).catch(() => {});
    } else {
      loadContacts();
    }
  });

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !active) return;
    setText('');
    try {
      const { data } = await api.post('/chat/send', { to: active._id, text: body });
      setMessages((ms) => [...ms, data.message]);
    } catch (err) {
      setText(body);
      setError(errMsg(err));
    }
  }

  const shown = contacts.filter((c) => (c.fullName + c.username).toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <h2>Chat</h2>
      {error && <p className="error">{error}</p>}
      <div className="chat card">
        <aside className="chat-list">
          <input placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} />
          {shown.length === 0 && <p className="muted small">No one to chat with yet.</p>}
          {shown.map((c) => (
            <button key={c._id} className={`chat-contact ${active && active._id === c._id ? 'on' : ''}`} onClick={() => setActive(c)}>
              <span>
                <strong>{c.fullName}</strong>
                <span className="muted small"> {ROLE_LABEL[c.role]}</span>
              </span>
              {c.unread > 0 && <span className="badge st-PENDING_PAYMENT">{c.unread}</span>}
            </button>
          ))}
        </aside>
        <div className="chat-pane">
          {!active ? (
            <p className="muted">{user.role === 'user' ? 'Choose a salesperson or the admin to ask a question.' : 'Choose someone to start chatting.'}</p>
          ) : (
            <>
              <div className="chat-head">
                <strong>{active.fullName}</strong> <span className="muted small">{ROLE_LABEL[active.role]}</span>
              </div>
              <div className="chat-messages">
                {messages.length === 0 && <p className="muted">No messages yet. Say hello!</p>}
                {messages.map((m) => (
                  <div key={m._id} className={`bubble ${m.from === user._id ? 'mine' : ''}`}>
                    <div>{m.text}</div>
                    <span className="muted small">{dt(m.createdAt)}</span>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form className="row" onSubmit={send}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" maxLength={2000} autoFocus />
                <button className="btn btn-primary">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
