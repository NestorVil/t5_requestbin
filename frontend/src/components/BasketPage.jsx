import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import services from '../communications/communications';
import RequestMethodDate from "./RequestMethodDate";
import RequestPageHeader from "./RequestPageHeader";
import RequestHeader from "./RequestHeader";
import RequestBody from "./RequestBody";
import RequestPath from "./RequestPath";

const socket = io("http://localhost:3000");
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
      <div className="container">
        <h1>Basket: {basketName}</h1>
        <p>This basket needs an access token.</p>
        <form onSubmit={(e) => { e.preventDefault(); load(tokenInput.trim()); }}>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="paste access token"
          />
          <button type="submit">Unlock</button>
        </form>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="container">
      <RequestPageHeader basketName={basketName} requests={requests} />

      <div className="col-md-10">
        {requests.map((request) => {
          return (
            <div className="row mb-5" key={request.id}>
              <RequestMethodDate request={request} />

              <div className="col-md-10">
                <div className="accordion" id="accordionExample">
                  <RequestPath request={request} />
                  <RequestHeader request={request} />
                  <RequestBody request={request} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BasketPage;
