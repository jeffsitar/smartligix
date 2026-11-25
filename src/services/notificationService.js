const db = require("../db/database");

function createNotification({ targetRole = null, targetUserId = null, title, message, severity = "INFO", link = "" }) {
    try {
        db.run(
            `INSERT INTO notifications (target_role, target_user_id, title, message, severity, link, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
            [targetRole, targetUserId, title, message, severity, link, new Date().toISOString()]
        );
    } catch (err) {
        console.error("Notification error:", err.message);
    }
}

module.exports = { createNotification };
