const RequestPath = ({ request }) => {
  return (
    <div className="req-path mb-2">
      <code className="req-path-value">{request.path}</code>
    </div>
  );
};

export default RequestPath;