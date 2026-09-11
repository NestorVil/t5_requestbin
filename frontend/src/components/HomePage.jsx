import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import services from '../communications/communications';
import BasketInput from "./BasketInput";
import BasketList from "./BasketList";

// websocket-only: skips the HTTP long-polling handshake, so there's no
// window where separate requests could land on different app instances
// behind the ALB before the connection is established.
const socket = io({ transports: ["websocket"] });

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
