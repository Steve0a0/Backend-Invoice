const Activity = require("../model/Activity");

/**
 * Log an activity to the database
 * @param {number} userId - User ID
 * @param {string} type - Activity type
 * @param {string} text - Activity description
 * @param {string|null} invoiceId - Invoice ID (optional)
 * @param {object|null} metadata - Additional metadata (optional)
 */
async function logActivity(userId, type, text, invoiceId = null, metadata = null) {
  try {
    await Activity.create({
      userId,
      type,
      text,
      invoiceId,
      metadata,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw - activity logging shouldn't break the main flow
  }
}

module.exports = { logActivity };
