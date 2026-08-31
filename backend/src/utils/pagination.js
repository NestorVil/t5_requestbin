// Parses and validates a pagination query param (limit or offset).
// Returns { value } on success, or { error } if the param was provided
// but isn't a valid non-negative integer. `undefined` (param not given at
// all) is treated as "use the default" rather than an error.
function parsePaginationParam(rawValue, { defaultValue, max } = {}) {
  if (rawValue === undefined) {
    return { value: defaultValue };
  }

  // Number(), not parseInt(), so that garbage like "20abc" or "1.5" is
  // correctly rejected rather than silently truncated to 20 or 1.
  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return { error: `must be a non-negative integer` };
  }

  const value = max !== undefined ? Math.min(parsed, max) : parsed;
  return { value };
}

module.exports = { parsePaginationParam };
