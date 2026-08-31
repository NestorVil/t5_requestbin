import 'bootstrap/dist/css/bootstrap.min.css';
import { Link } from 'react-router-dom';

const BasketList = ({ baskets }) => {
  return (
    <div className="col-md-4">
      <div className="panel panel-default">
        <div className="panel-heading">My baskets:</div>
        {baskets.length > 0 ? (
          <ul>
            {baskets.map((basket) => (
              <li key={basket}>
                <Link to={`/web/${basket}`}>{basket}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No items found.</p>
        )}

      </div>
    </div>
  );
};

export default BasketList;