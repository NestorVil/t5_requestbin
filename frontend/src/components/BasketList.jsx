const BasketList = ({ baskets, onDelete}) => {
  return (
    <div>
      <div className="eyebrow">My baskets</div>
      {baskets.length === 0 ? (
        <div className="card-surface empty">No baskets yet — create one above.</div>
      ) : (
        <div className="card-surface" style={{ overflow: "hidden" }}>
          {baskets.map((basket, i) => {
            return (
              // basket has no id for some reason so assigning basket.id as name does not work
              <div
                key={basket.name}
                className="basket-row"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <a href={`/web/${basket.name}`}>{basket.name}</a>
                <button
                  className="btn2 btn2-danger btn2-sm"
                  onClick={() => onDelete(basket.name)}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BasketList;
