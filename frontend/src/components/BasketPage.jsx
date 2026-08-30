import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function BasketPage() {
  const { basketName } = useParams();
  const webhookUrl = `http://localhost:3000/${basketName}`;
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const getRequests = async () => {
      try {
        const res = await axios.get(`/api/baskets/${basketName}/requests`);
        setRequests(res.data);
      } catch (error) {
        console.error(error.message);
      }
    };
    getRequests();
  }, []);

  return (
    <div className="container">
      <h1>Basket: {basketName}</h1>
      <p>Send webhook requests to: {webhookUrl}</p>

      <div className="col-md-10">
        {requests.map((request) => {
          const dateTime = new Date(request.received_at);
          const time = dateTime.toLocaleTimeString("en-US");
          const date = dateTime.toLocaleDateString("en-US");
          return (
            <div className="row mb-5" key={request.id}>
              <div className="col-md-2">
                <h4>[{request.method.toUpperCase()}]</h4>
                <div>{time}</div>
                <div>{date}</div>
              </div>
              <div className="col-md-10">
                <div className="accordion" id="accordionExample">
                  <div className="accordion-item">
                    <h2
                      className="accordion-header"
                      id={`headingOne${request.id}`}
                    >
                      <button
                        className="accordion-button"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapseOne${request.id}`}
                        aria-expanded="true"
                        aria-controls={`collapseOne${request.id}`}
                      >
                        Headers
                      </button>
                    </h2>
                    <div
                      id={`collapseOne${request.id}`}
                      className="accordion-collapse collapse"
                      aria-labelledby={`headingOne${request.id}`}
                      data-bs-parent="#accordionExample"
                    >
                      <div className="accordion-body">
                        <pre>{JSON.stringify(request.headers, null, 2)}</pre>
                      </div>
                    </div>
                  </div>

                  <div className="accordion-item">
                    <h2
                      className="accordion-header"
                      id={`headingTwo${request.id}`}
                    >
                      <button
                        className="accordion-button collapsed"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapseTwo${request.id}`}
                        aria-expanded="false"
                        aria-controls={`collapseTwo${request.id}`}
                      >
                        Accordion Item #2
                      </button>
                    </h2>
                    <div
                      id={`collapseTwo${request.id}`}
                      className="accordion-collapse collapse show"
                      aria-labelledby={`headingTwo${request.id}`}
                      data-bs-parent="#accordionExample"
                    >
                      <div className="accordion-body">
                        <pre>{JSON.stringify(request.body)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default BasketPage;
