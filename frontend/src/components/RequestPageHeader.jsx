const RequestPageHeader = ({ basketName, requests }) => {
  const webhookUrl = `<ngrok domain name>/basket/${basketName}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(webhookUrl);
  };

  return (
    <>
      <h1>Basket: {basketName}</h1>
      <div>Requests: {requests.length}</div>
      <p>
        Send webhook requests to: {webhookUrl}
        <button onClick={copyToClipboard}>Click to copy</button>
      </p>
    </>
  );
};

export default RequestPageHeader;