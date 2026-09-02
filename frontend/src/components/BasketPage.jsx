import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import services from '../communications/communications';
import RequestMethodDate from "./RequestMethodDate";
import RequestPageHeader from "./RequestPageHeader";
import RequestHeader from "./RequestHeader";
import RequestBody from "./RequestBody";

const socket = io("http://localhost:3000");

function BasketPage() {
  const { basketName } = useParams();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const getRequests = async () => {
      const data = await services.getBasketRequests(basketName);

      const newestFirst = (a, b) => new Date(b.received_at) - new Date(a.received_at);
      setRequests([...data].sort(newestFirst));
    };

    getRequests();

    socket.on("webhook-update", (newRequest) => {
      console.log("🔥 WebSocket event received:", newRequest);

      setRequests((currentRequests) => [...currentRequests, newRequest]);
    });

    return () => {
      socket.off("webhook-update");
    };
  }, [basketName]);

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
