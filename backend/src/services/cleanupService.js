const db = require('../db/postgres');
const config = require('../config/env');
const wsService = require('./wsService');

// A basket's "age" is based on its most recent request's received_at,
// falling back to the basket's own created_at if it has never received
// a request. Deleting a basket cascades (via ON DELETE CASCADE) to its
// requests automatically.
async function deleteExpiredBaskets() {
  const cutoff = new Date(Date.now() - config.cleanup.expirationMs);

  const result = await db.query(
    `DELETE FROM baskets
     WHERE id IN (
       SELECT b.id FROM baskets b
       LEFT JOIN (
         SELECT basket_id, MAX(received_at) AS last_activity
         FROM requests
         GROUP BY basket_id
       ) r ON r.basket_id = b.id
       WHERE COALESCE(r.last_activity, b.created_at) < $1
     )
     RETURNING id`,
    [cutoff]
  );

  // Anyone watching a deleted basket's live stream needs to be
  // disconnected — same reasoning as the manual DELETE route.
  for (const row of result.rows) {
    wsService.closeBasketConnections(row.id);
  }

  if (result.rowCount > 0) {
    console.log(`Cleanup: deleted ${result.rowCount} expired basket(s)`);
  }

  return result.rowCount;
}

function startCleanupJob() {
  deleteExpiredBaskets().catch((err) => console.error('Cleanup job failed', err));

  return setInterval(() => {
    deleteExpiredBaskets().catch((err) => console.error('Cleanup job failed', err));
  }, config.cleanup.intervalMs);
}

module.exports = { deleteExpiredBaskets, startCleanupJob };
