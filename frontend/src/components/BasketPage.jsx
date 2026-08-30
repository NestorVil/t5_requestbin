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
        const res = await axios.get(`/api/new-basket`);
        setRequests(res.data);
      } catch (error) {
        console.error(error.message);
      }
    };
    getRequests();
  }, []);

  return (
    <>
      <div>
        <h1>Basket: {basketName}</h1>
        <p>Send webhook requests to: {webhookUrl}</p>

        <ul>
          {requests.map((request) => {
            return (
              <li>
                <p>{request.headers}</p>
                <p>{request.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
export default BasketPage;
