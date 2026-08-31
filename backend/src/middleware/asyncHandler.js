// Express 4 does not automatically catch a rejected Promise from an async
// route handler — without this, a thrown/rejected error inside `async (req,
// res) => {...}` just becomes an unhandled rejection, and the client's
// request hangs forever with no response. Wrapping every handler with this
// ensures any error reaches the centralized error-handling middleware
// (see middleware/errorHandler.js) via next(err), which sends a real
// response instead.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
