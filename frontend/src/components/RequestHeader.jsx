const RequestHeader = ({ request }) => {
  console.log(request);
  return (
    <div className="accordion-item">
      <h2
        className="accordion-header"
        id={`headingOne${request.id}`}
      >
        <button
          className="accordion-button"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target={`#collapseOne${request.id}`}
          aria-expanded="true"
          aria-controls={`collapseOne${request.id}`}
        >
          Headers
        </button>
      </h2>
      <div
        id={`collapseOne${request.id}`}
        className="accordion-collapse collapse"
        aria-labelledby={`headingOne${request.id}`}
        data-bs-parent="#accordionExample"
      >
        <div className="accordion-body">
          <pre>{JSON.stringify(request.headers, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default RequestHeader;