import { useParams } from 'react-router-dom';

const BasketContent = () => {
  const { basket } = useParams();

  return (
    <p>{basket}</p>
  )
};

export default BasketContent;