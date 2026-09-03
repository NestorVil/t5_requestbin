import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import services from '../communications/communications';
import BasketInput from "./BasketInput";
import BasketList from "./BasketList";

const socket = io("http://localhost:3000");

function HomePage() {
  const [basketName, setBasketName] = useState("");
  const [baskets, setBaskets] = useState([]);
  const refreshBaskets = () => setBaskets(services.listBaskets());
  const handleDelete = async (name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await services.deleteBasket(name);
    refreshBaskets();
  }

  useEffect(() => {
    const getBasketName = async () => {
      const newBasketName = await services.getNewBasketName();
      const newBaskets = services.listBaskets();

      setBasketName(newBasketName);
      setBaskets(newBaskets);
    };

    getBasketName();

    const handleCronDelete = (deletedBaskets) => {
      const namesToRemove = deletedBaskets.map((basket) => basket.name);
      if (namesToRemove.length > 0) {
        window.location.href = "/web";
      }
    };

    socket.on("cron-delete", handleCronDelete);

    return () => {
      socket.off("cron-delete", handleCronDelete);
    };
  }, []);

  return (
    <div className="page">
      <BasketInput basketName={basketName} setBasketName={setBasketName} />
      <BasketList baskets={baskets} onDelete={handleDelete} />
    </div>
  );
}
export default HomePage;
