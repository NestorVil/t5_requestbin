// Rebuilds a text approximation of the original HTTP/1.1 message using
// req.rawHeaders (which preserves original header order and casing, unlike
// req.headers). This is the payload stored as a backup in MongoDB — not
// read during normal app operation.
function buildRawHttpText(req) {
  const requestLine = `${req.method} ${req.originalUrl} HTTP/1.1`;

  const headerLines = [];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
  }

  const body = typeof req.body === 'string' ? req.body : '';

  return [requestLine, ...headerLines, '', body].join('\n');
}

module.exports = { buildRawHttpText };
