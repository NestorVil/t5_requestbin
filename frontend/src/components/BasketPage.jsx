import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import services from '../communications/communications';
import RequestMethodDate from "./RequestMethodDate";
import RequestPageHeader from "./RequestPageHeader";
import RequestHeader from "./RequestHeader";
import RequestBody from "./RequestBody";
import RequestPath from "./RequestPath";

const socket = io(
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : import.meta.env.VITE_SOCKET_URL
);

const newestFirst = (a, b) => new Date(b.received_at) - new Date(a.received_at)

function BasketPage() {
  const { basketName } = useParams();
  const [requests, setRequests] = useState([]);

  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (tokenOverride) => {
    const res = await services.getBasketRequests(basketName, tokenOverride);
    if (res.ok) {
      setRequests([...res.data].sort(newestFirst));
      setNeedsToken(false);
      setError("");
    } else if (res.status === 403) {
      setNeedsToken(true);
      if (tokenOverride) setError("That token was rejected.");
    } else if (res.status === 404) {
      setError("Basket not found.");
    }
  }, [basketName]);

  useEffect(() => {
    load(); // was getRequests()
    console.log('test');
    socket.on("webhook-update", (event) => {
      if (event?.basketName === basketName) load();
    });

    socket.on("cron-delete", (deletedBaskets) => {
      if (deletedBaskets.some((basket) => basket.name === basketName)) {
        window.location.href = "/web";
      }
    });

    return () => {
      socket.off("webhook-update");
      socket.off("cron-delete");
    };
  }, [basketName, load]);

  if (needsToken) {
    return (
      <div className="page">
        <div className="card-surface p-4" style={{ maxWidth: 460 }}>
          <div className="eyebrow">Locked</div>
          <h1 className="h4 mb-1">{basketName}</h1>
          <p className="text-muted mb-3" style={{ fontSize: ".9rem" }}>
            This basket needs an access token.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); load(tokenInput.trim()); }}
            className="d-flex gap-2 flex-wrap"
          >
            <input
              type="text"
              className="field"
              style={{ flex: "1 1 220px" }}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="paste access token"
            />
            <button type="submit" className="btn2 btn2-primary">Unlock</button>
          </form>
          {error && (
            <p className="mt-2 mb-0" style={{ color: "var(--danger)", fontSize: ".9rem" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <RequestPageHeader basketName={basketName} requests={requests} />

      {requests.length === 0 ? (
        <div className="card-surface empty">
          No requests yet. Send one to the endpoint above.
        </div>
      ) : (
        requests.map((request, i) => {
          return (
            <div
              className="req-card card-surface p-3"
              key={request.id}
              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
            >
              <RequestMethodDate request={request} />

              <div className="accordion mt-2" id="accordionExample">
                <RequestPath request={request} />
                <RequestHeader request={request} />
                <RequestBody request={request} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default BasketPage;