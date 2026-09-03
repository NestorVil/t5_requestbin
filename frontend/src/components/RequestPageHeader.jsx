const RequestPageHeader = ({ basketName, requests }) => {
  const webhookUrl = `<ngrok domain name>/basket/${basketName}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(webhookUrl);
  };

  return (
    <div className="mb-4">
      <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
        <h1 className="h3 mb-0">{basketName}</h1>
        <span className="badge rounded-pill text-bg-secondary">
          {requests.length} request{requests.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="eyebrow mt-3">Send webhook requests to</div>
      <div className="endpoint">
        <code>{webhookUrl}</code>
        <button onClick={copyToClipboard}>Copy</button>
      </div>
    </div>
  );
};

export default RequestPageHeader;
