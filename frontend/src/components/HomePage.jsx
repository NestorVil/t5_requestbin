import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const [basketName, setBasketName] = useState("");
  const [baskets, setBaskets] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    const getBasketName = async () => {
      try {
        const res = await axios.get(`/api/new-basket`);
        setBasketName(res.data);
      } catch (error) {
        console.error(error.message);
      }
    };
    getBasketName();
  }, []);

  const createBasket = async (e) => {
    e.preventDefault();

    try {
      const data = { session_id: 3, name: basketName, total_count: 0 };
      await axios.post(`/api/baskets/${basketName}`, data);
      navigate(`/web/${basketName}`);
    } catch (error) {
      alert(error.response.data.message);
      console.error(error.message);
    }
  };

  return (
    <div>
      <h1>New Basket</h1>
      <input
        type="text"
        name=""
        id=""
        value={basketName}
        onChange={(e) => setBasketName(e.target.value)}
      />
      <button onClick={createBasket}>Create</button>
      <div>
        <p>My Baskets:</p>
        {baskets.map((basket) => {
          return <li>{basket.name}</li>;
        })}
      </div>
    </div>
  );
}
export default HomePage;
