const config = require('../config/env');
const sessionService = require('../services/sessionService');

// Attaches req.sessionId for every request. If the incoming cookie is
// missing or doesn't match a real session, a new one is created and set
// on the response. No login/accounts involved — losing this cookie means
// losing access to whatever baskets were tied to it, which is expected.
async function sessionMiddleware(req, res, next) {
  try {
    const cookieValue = req.cookies?.[config.session.cookieName];
    let sessionId = cookieValue && (await sessionService.findSession(cookieValue))?.id;

    if (!sessionId) {
      sessionId = await sessionService.createSession();
      res.cookie(config.session.cookieName, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: config.session.maxAgeMs,
      });
    } else {
      // Fire-and-forget: don't block the request on this housekeeping update
      sessionService.touchSession(sessionId).catch((err) => {
        console.error('Failed to update session last_seen_at', err);
      });
    }

    req.sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = sessionMiddleware;
