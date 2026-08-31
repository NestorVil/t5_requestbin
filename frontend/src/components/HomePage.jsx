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
        const newBasketName = await axios.get(`/api/new-basket`);
        const newBaskets = await axios.get("/api/baskets");
        setBasketName(newBasketName.data);
        setBaskets(newBaskets.data);
      } catch (error) {
        console.error(error.message);
      }
    };
    getBasketName();
  }, []);

  const createBasket = async (e) => {
    e.preventDefault();

    try {
      await axios.post(`/api/baskets/${basketName}`);
      navigate(`/web/${basketName}`);
    } catch (error) {
      alert(error.response.data.message);
      console.error(error.message);
    }
  };

  return (
    <div className="container">
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
        <div>My Baskets:</div>
        {baskets.map((basket) => {
          return (
            <div key={basket.id}>
              <a href={`/web/${basket.name}`}>{basket.name}</a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default HomePage;
