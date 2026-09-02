const BasketList = ({ baskets }) => {
  return (
    <div>
      <div>My Baskets:</div>
      {baskets.map((basket) => {
        return (
          // basket has no id for some reason so assigning basket.id as name does not work
          <div key={basket.name}>
            <a href={`/web/${basket.name}`}>{basket.name}</a>
          </div>
        );
      })}
    </div>
  );
};

export default BasketList;