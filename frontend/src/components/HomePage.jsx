import { useEffect, useState } from "react";
import services from '../communications/communications';
import BasketInput from "./BasketInput";
import BasketList from "./BasketList";

function HomePage() {
  const [basketName, setBasketName] = useState("");
  const [baskets, setBaskets] = useState([]);

  useEffect(() => {
    const getBasketName = async () => {
      const newBasketName = await services.getNewBasketName();
      const newBaskets = await services.getNewBaskets();

      setBasketName(newBasketName);
      setBaskets(newBaskets);
    };

    getBasketName();
  }, []);

  return (
    <div className="container">
      <BasketInput basketName={basketName} setBasketName={setBasketName} />
      <BasketList baskets={baskets}/>
    </div>
  );
}
export default HomePage;
