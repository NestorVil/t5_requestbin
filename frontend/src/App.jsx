import { useCallback, useEffect, useState } from 'react';

const BIN_KEY = 'requestbin.binId';
const POLL_MS = 2000;

export default function App() {
  const [binId, setBinId] = useState(() => localStorage.getItem(BIN_KEY) || '');
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const ingestUrl = binId ? `${window.location.origin}/b/${binId}` : '';

  const createBin = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/bins', { method: 'POST' });
      if (!res.ok) throw new Error(`create failed (${res.status})`);
      const bin = await res.json();
      localStorage.setItem(BIN_KEY, bin.binId);
      setBinId(bin.binId);
      setRequests([]);
      setSelectedId(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  const loadRequests = useCallback(async () => {
    if (!binId) return;
    try {
      const res = await fetch(`/api/bins/${binId}/requests`);
      if (res.status === 404) {
        // bin no longer exists (e.g. backend restarted) - reset
        localStorage.removeItem(BIN_KEY);
        setBinId('');
        setRequests([]);
        return;
      }
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = await res.json();
      setRequests(data.requests);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [binId]);

  useEffect(() => {
    if (!binId) return;
    loadRequests();
    const t = setInterval(loadRequests, POLL_MS);
    return () => clearInterval(t);
  }, [binId, loadRequests]);

  const sendTestRequest = useCallback(async () => {
    if (!binId) return;
    await fetch(`/b/${binId}/hello?demo=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world', at: new Date().toISOString() }),
    });
    loadRequests();
  }, [binId, loadRequests]);

  const clearRequests = useCallback(async () => {
    if (!binId) return;
    await fetch(`/api/bins/${binId}/requests`, { method: 'DELETE' });
    setRequests([]);
    setSelectedId(null);
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

  const selected = requests.find((r) => r.id === selectedId) || null;

  return (
    <>
      <h1>Request Bin</h1>
      <p className="muted">
        Scaffold stage &mdash; in-memory only, polling every {POLL_MS / 1000}s.
      </p>

      {error && (
        <p style={{ color: '#b00' }}>
          {error} <button onClick={() => setError('')}>dismiss</button>
        </p>
      )}

      {!binId ? (
        <button onClick={createBin}>Create a bin</button>
      ) : (
        <>
          <div className="row">
            <span>Ingest endpoint:</span>
            <code className="endpoint">{ingestUrl}</code>
            <button onClick={copyEndpoint}>{copied ? 'Copied!' : 'Copy'}</button>
            <button onClick={sendTestRequest}>Send test request</button>
            <button onClick={clearRequests}>Clear</button>
            <button onClick={createBin}>New bin</button>
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
              {!selected ? (
                <span className="muted">Select a request to inspect it.</span>
              ) : (
                <RequestDetail request={selected} />
              )}
            </div>
          </div>
        </>
      )}
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

      <h3>Body</h3>
      <pre>{request.body || '(empty)'}</pre>
    </>
  );
}
