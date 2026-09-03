import services from '../communications/communications';
import { useNavigate } from "react-router-dom";

const BasketInput = ({ basketName, setBasketName}) => {
  const navigate = useNavigate();

  const createBasket = async (e) => {
    e.preventDefault();

    const data = await services.createBasket(basketName);
    window.prompt("Your token (copy it now — shown only once): ", data.token);
    navigate(`/web/${basketName}`);
  };

  return (
    <div className="card-surface p-4 mb-4">
      <div className="eyebrow">Create</div>
      <h1 className="h4 mb-1">New basket</h1>
      <p className="text-muted mb-3" style={{ fontSize: ".9rem" }}>
        Pick a name, or use the suggested one.
      </p>
      <div className="d-flex gap-2 flex-wrap">
        <input
          type="text"
          name=""
          id=""
          className="field"
          style={{ flex: "1 1 220px" }}
          placeholder="my-bin-name"
          value={basketName}
          onChange={(e) => setBasketName(e.target.value)}
        />
        <button onClick={createBasket} className="btn2 btn2-primary">
          Create basket
        </button>
      </div>
    </div>
  );
};

export default BasketInput;