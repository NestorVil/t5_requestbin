// A 4-argument function is what tells Express this is error-handling
// middleware — it's only ever invoked when something calls next(err), or
// when a wrapped async handler's rejection reaches here via asyncHandler.
// This must be the LAST thing app.use()'d in server.js, after every route.
function errorHandler(err, req, res, next) {
  // Full detail (including the stack trace) goes to the server's own logs
  // only — never to the client, since that can leak internal file paths,
  // dependency versions, and other implementation details.
  console.error(err);

  // express.text()/body-parser sets this specific `type` when a request
  // body exceeds the configured size limit.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
