import services from '../communications/communications';
import { useNavigate } from "react-router-dom";

const BasketInput = ({ basketName, setBasketName}) => {
  const navigate = useNavigate();

  const createBasket = async (e) => {
    e.preventDefault();

    await services.createBasket(basketName);
    navigate(`/web/${basketName}`);
  };

  return (
    <>
      <h1>New Basket</h1>
      <input
        type="text"
        name=""
        id=""
        value={basketName}
        onChange={(e) => setBasketName(e.target.value)}
      />

      <button onClick={createBasket}>Create</button>
    </>
  );
};

export default BasketInput;