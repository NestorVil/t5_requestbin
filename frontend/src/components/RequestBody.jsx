const RequestBody = ({ request }) => {
  return (
    <div className="accordion-item">
      <h2
        className="accordion-header"
        id={`headingTwo${request.id}`}
      >
        <button
          className="accordion-button collapsed"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target={`#collapseTwo${request.id}`}
          aria-expanded="false"
          aria-controls={`collapseTwo${request.id}`}
        >
          Body
        </button>
      </h2>
      <div
        id={`collapseTwo${request.id}`}
        className="accordion-collapse collapse show"
        aria-labelledby={`headingTwo${request.id}`}
        data-bs-parent="#accordionExample"
      >
        <div className="accordion-body">
          <pre>{JSON.stringify(request.body)}</pre>
        </div>
      </div>
    </div>
  );
};

export default RequestBody;