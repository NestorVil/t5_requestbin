import 'bootstrap/dist/css/bootstrap.min.css';
import { useState } from 'react';

const BasketCreation = ({ setBaskets }) => {
  const [basketName, setBasketName] = useState('');

  const inputChange = (event) => {
    setBasketName(event.target.value);
  };

  const onSubmitForm = async (event) => {
    event.preventDefault();
    console.log(basketName);
    // Alert user if basket already exists, or just make the basket and redirect them to it 
    // const addBasket = await services.addBasket(newBasket)
    // setBaskets(baskets => baskets.concat(newBasket))

    setBasketName('');
  };

  return (
    <div className="jumbotron text-center p-5 bg-light">
      <h1>New Basket</h1>
      <p>Create your new basket here</p>

      <form className="navbar-form" onSubmit={onSubmitForm}>
        <div className="form-group d-flex justify-content-center align-items-center">
          <span>t5baskets.in/</span>

          <input
            type="text"
            value={basketName}
            className="form-control ms-2"
            style={{ width: "200px" }}
            onChange={inputChange}
          />
        </div>
        <button type='submit' className='btn btn-success'>Create</button>
      </form>
    </div>
  );
};

export default BasketCreation;
