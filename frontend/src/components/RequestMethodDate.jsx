const RequestMethodDate = ({ request }) => {
  const dateTime = new Date(request.received_at);
  const time = dateTime.toLocaleTimeString("en-US");
  const date = dateTime.toLocaleDateString("en-US");

  const m = request.method.toLowerCase();
  const cls = ["get", "post", "put", "patch", "delete"].includes(m)
    ? `m-${m}`
    : "m-other";

  return (
    <div className="d-flex align-items-center gap-2">
      <span className={`method-badge ${cls}`}>{request.method.toUpperCase()}</span>
      <span className="timestamp">
        {date} &middot; {time}
      </span>
    </div>
  );
};

export default RequestMethodDate;
