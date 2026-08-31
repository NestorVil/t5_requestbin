import 'bootstrap/dist/css/bootstrap.min.css';
import BasketCreation from './BasketCreation';
import BasketList from './BasketList';

const BasketHomepage = ({ baskets, setBaskets }) => {
  return (
    <div className="container">
      <div className="row">
        <BasketCreation setBaskets={setBaskets} />
        <BasketList baskets={baskets}/>
      </div>
    </div>
  );
}

export default BasketHomepage;