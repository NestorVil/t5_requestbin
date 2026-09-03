import { useState } from "react";

// wrap JSON tokens in <span>s; input is escaped first so it's safe to inject
function highlightJson(json) {
  const esc = json.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"
  );
  return esc.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "j-num";
      if (/^"/.test(m)) cls = /:\s*$/.test(m) ? "j-key" : "j-str";
      else if (m === "true" || m === "false") cls = "j-bool";
      else if (m === "null") cls = "j-null";
      return `<span class="${cls}">${m}</span>`;
    }
  );
}

const RequestBody = ({ request }) => {
  const compact = JSON.stringify(request.body);
  const formatted = JSON.stringify(request.body, null, 2);
  const isJson = request.body !== null && typeof request.body === "object";

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
          {isJson ? (
            <pre
              className="json-pretty"
              dangerouslySetInnerHTML={{ __html: highlightJson(formatted) }}
            />
          ) : (
            <pre>{compact}</pre>
          )}
        </div>
      </div>
<style>{`
  pre.json-pretty {
    background:#fff;
    color:#24292e;
    border:1px solid #e1e4e8;
    padding:.75rem;
    border-radius:6px;
    overflow:auto;
  }
  pre.json-pretty .j-key  { color:#8250df; }   /* keys   – purple */
  pre.json-pretty .j-str  { color:#0a7b34; }   /* strings – green  */
  pre.json-pretty .j-num  { color:#b76100; }   /* numbers – orange */
  pre.json-pretty .j-bool { color:#0550ae; }   /* true/false – blue */
  pre.json-pretty .j-null { color:#6e7781; }   /* null – gray */
`}</style>
    </div>
  );
};

export default RequestBody;