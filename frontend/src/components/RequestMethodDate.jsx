const RequestMethodDate = ({ request }) => {
  const dateTime = new Date(request.received_at);
  const time = dateTime.toLocaleTimeString("en-US");
  const date = dateTime.toLocaleDateString("en-US");

  return (
    <div className="col-md-2">
      <h4>[{request.method.toUpperCase()}]</h4>
      <div>{time}</div>
      <div>{date}</div>
    </div>
  );
};

export default RequestMethodDate;