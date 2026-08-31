import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadBins, addBin, removeBin } from './bins.js';

// Where captured requests are sent. The backend serves them at its own origin's
// root (e.g. http://localhost:3001/<bin-name>). Override for ngrok/prod with
// VITE_INGEST_BASE, e.g. VITE_INGEST_BASE=https://abc123.ngrok-free.app
const INGEST_BASE =
  import.meta.env.VITE_INGEST_BASE ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

// ---------------------------------------------------------------------------
// tiny hash router: #/ -> index, #/<binId> -> one bin
// ---------------------------------------------------------------------------
function parseHash() {
  const m = window.location.hash.match(/^#\/(.+)$/);
  return m ? { name: 'bin', binId: decodeURIComponent(m[1]) } : { name: 'index' };
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const goIndex = () => {
  window.location.hash = '#/';
};
const goBin = (binId) => {
  window.location.hash = `#/${encodeURIComponent(binId)}`;
};

// ---------------------------------------------------------------------------

export default function App() {
  const route = useHashRoute();

  return (
    <>
      <header className="app">
        <h1 className="crumb" onClick={goIndex}>Request Bin</h1>
        {route.name === 'bin' && (
          <span className="muted">
            / <code>{route.binId}</code>
          </span>
        )}
      </header>
      <p className="muted">Postgres + MongoDB backend. Your bin list is kept in localStorage.</p>

      {route.name === 'bin' ? (
        <BinView key={route.binId} binId={route.binId} />
      ) : (
        <BinIndex />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

const BIN_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;

function BinIndex() {
  const [bins, setBins] = useState(loadBins);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const trimmed = name.trim();
  const valid = BIN_ID_RE.test(trimmed);

  const createBin = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!valid || busy) return;
      setError('');
      setBusy(true);
      try {
        const res = await fetch('/api/bins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ binId: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `create failed (${res.status})`);
        setBins(addBin({ binId: data.binId, createdAt: data.createdAt }));
        setName('');
        goBin(data.binId);
      } catch (err) {
        setError(String(err.message || err));
      } finally {
        setBusy(false);
      }
    },
    [trimmed, valid, busy]
  );

  const deleteBin = useCallback(async (binId) => {
    try {
      await fetch(`/api/bins/${binId}`, { method: 'DELETE' });
    } catch {
      /* server may be down / bin already gone - still drop it locally */
    }
    setBins(removeBin(binId));
    setConfirmId(null);
  }, []);

  return (
    <>
      <form className="row" onSubmit={createBin}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-endpoint-name"
          aria-label="endpoint name"
          autoFocus
        />
        <button type="submit" disabled={busy || !valid}>
          {busy ? 'Creating…' : 'Create bin'}
        </button>
        <span className="muted">{bins.length} bin{bins.length === 1 ? '' : 's'}</span>
      </form>

      {trimmed && (
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          {valid ? (
            <>endpoint: <code>{INGEST_BASE}/{trimmed}</code></>
          ) : (
            '3–64 characters: letters, numbers, hyphen, underscore'
          )}
        </p>
      )}

      {error && (
        <p style={{ color: '#b00' }}>
          {error} <button onClick={() => setError('')}>dismiss</button>
        </p>
      )}

      {bins.length === 0 ? (
        <p className="muted">No bins yet. Create one to get an endpoint.</p>
      ) : (
        <div className="bin-list">
          {bins.map((b) => (
            <div className="bin-row" key={b.binId}>
              <div className="grow">
                <code className="crumb" onClick={() => goBin(b.binId)}>{b.binId}</code>
                <div className="sub">
                  {b.createdAt ? new Date(b.createdAt).toLocaleString() : 'unknown date'}
                </div>
              </div>
              <button onClick={() => goBin(b.binId)}>Open</button>
              {confirmId === b.binId ? (
                <>
                  <button className="danger" onClick={() => deleteBin(b.binId)}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmId(null)}>Cancel</button>
                </>
              ) : (
                <button className="danger" onClick={() => setConfirmId(b.binId)}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function BinView({ binId }) {
  const [status, setStatus] = useState('loading'); // loading | ok | missing
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const ingestUrl = `${INGEST_BASE}/${binId}`;

  // existence check + local registration (covers opening via a shared link)
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch(`/api/bins/${binId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setStatus('missing');
          return;
        }
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const bin = await res.json();
        setStatus('ok');
        addBin({ binId, createdAt: bin.createdAt });
      })
      .catch((e) => !cancelled && setError(String(e.message || e)));
    return () => {
      cancelled = true;
    };
  }, [binId]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/bins/${binId}/requests`);
      if (res.status === 404) {
        setStatus('missing');
        return;
      }
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = await res.json();
      setRequests(data.requests);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [binId]);

  // live updates over WebSocket (replaces polling)
  useEffect(() => {
    if (status !== 'ok') return;

    let ws;
    let reconnectTimer;
    let stopped = false;
    let backoff = 1000;

    const connect = () => {
      loadRequests(); // sync the current list on connect / reconnect

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(
        `${proto}://${window.location.host}/ws?bin=${encodeURIComponent(binId)}`
      );

      ws.onopen = () => {
        backoff = 1000;
      };

      ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (msg.type === 'request:new') {
          setRequests((prev) =>
            prev.some((r) => r.id === msg.request.id)
              ? prev
              : [msg.request, ...prev].slice(0, 100)
          );
        } else if (msg.type === 'requests:cleared') {
          setRequests([]);
          setSelectedId(null);
          setDetail(null);
        } else if (msg.type === 'bin:deleted') {
          setStatus('missing');
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        reconnectTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // intentional close - don't reconnect
        ws.close();
      }
    };
  }, [status, binId, loadRequests]);

  // full detail (incl. raw body) is fetched on demand when a request is selected
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    fetch(`/api/bins/${binId}/requests/${selectedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [selectedId, binId]);

  const sendTestRequest = useCallback(async () => {
    await fetch(`${INGEST_BASE}/${binId}/hello?demo=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world', at: new Date().toISOString() }),
    });
    loadRequests();
  }, [binId, loadRequests]);

  const clearRequests = useCallback(async () => {
    await fetch(`/api/bins/${binId}/requests`, { method: 'DELETE' });
    setRequests([]);
    setSelectedId(null);
    setDetail(null);
  }, [binId]);

  const recreate = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `recreate failed (${res.status})`);
      addBin({ binId, createdAt: data.createdAt });
      setStatus('ok');
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [binId]);

  const copyEndpoint = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ingestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - ignore */
    }
  }, [ingestUrl]);

  if (status === 'loading') return <p className="muted">Loading…</p>;

  if (status === 'missing') {
    return (
      <div className="banner">
        <p>
          Bin <code>{binId}</code> doesn&rsquo;t exist on the server &mdash; it was
          deleted, or never created here.
        </p>
        {error && <p style={{ color: '#b00' }}>{error}</p>}
        <div className="row">
          <button onClick={recreate}>Recreate this bin</button>
          <button onClick={() => { removeBin(binId); goIndex(); }}>
            Remove from my list
          </button>
          <button onClick={goIndex}>Back to all bins</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p style={{ color: '#b00' }}>
          {error} <button onClick={() => setError('')}>dismiss</button>
        </p>
      )}

      <div className="row">
        <button onClick={goIndex}>&larr; All bins</button>
        <span>Ingest endpoint:</span>
        <code className="endpoint">{ingestUrl}</code>
        <button onClick={copyEndpoint}>{copied ? 'Copied!' : 'Copy'}</button>
        <button onClick={sendTestRequest}>Send test request</button>
        <button onClick={clearRequests}>Clear</button>
      </div>

      <div className="layout">
        <div className="list">
          {requests.length === 0 && (
            <div className="list-item muted">No requests yet.</div>
          )}
          {requests.map((r) => (
            <div
              key={r.id}
              className={`list-item${r.id === selectedId ? ' active' : ''}`}
              onClick={() => setSelectedId(r.id)}
            >
              <div className="row">
                <span className="method">{r.method}</span>
                <span>{r.path}</span>
              </div>
              <div className="muted" style={{ fontSize: '0.75rem' }}>
                {new Date(r.receivedAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        <div className="detail">
          {!selectedId ? (
            <span className="muted">Select a request to inspect it.</span>
          ) : !detail ? (
            <span className="muted">Loading…</span>
          ) : (
            <RequestDetail request={detail} />
          )}
        </div>
      </div>
    </>
  );
}

function RequestDetail({ request }) {
  return (
    <>
      <div className="row">
        <span className="method">{request.method}</span>
        <code>{request.path}</code>
      </div>
      <p className="muted" style={{ fontSize: '0.8rem' }}>
        {new Date(request.receivedAt).toLocaleString()} &middot; {request.bodySize} bytes
      </p>

      <h3>Query</h3>
      <pre>{JSON.stringify(request.query, null, 2)}</pre>

      <h3>Headers</h3>
      <table>
        <tbody>
          {Object.entries(request.headers).map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <BodyView body={request.body} />
    </>
  );
}

// Returns pretty-printed JSON, or null if the body isn't valid JSON.
function prettyJson(body) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return null;
  }
}

// Wrap JSON tokens in <span> for coloring. Input is escaped first, so the
// result is safe to inject as HTML.
function highlightJson(json) {
  const escaped = json.replace(/[&<>]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'
  );
  return escaped.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'j-num';
      if (/^"/.test(match)) {
        cls = /:\s*$/.test(match) ? 'j-key' : 'j-str';
      } else if (match === 'true' || match === 'false') {
        cls = 'j-bool';
      } else if (match === 'null') {
        cls = 'j-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function BodyView({ body }) {
  const [formatted, setFormatted] = useState(false);
  const pretty = useMemo(() => (body ? prettyJson(body) : null), [body]);
  const canFormat = pretty !== null;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Body</h3>
        {canFormat && (
          <button onClick={() => setFormatted((f) => !f)}>
            {formatted ? 'Show raw' : 'Format JSON'}
          </button>
        )}
      </div>
      {formatted && canFormat ? (
        <pre
          className="json"
          dangerouslySetInnerHTML={{ __html: highlightJson(pretty) }}
        />
      ) : (
        <pre>{body || '(empty)'}</pre>
      )}
    </>
  );
}
