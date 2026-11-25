const db = require("../db/database");

function logAudit({ actorEmail, actorRole, action, entityType, entityId = "", details = "", ipAddress = "" }) {
    try {
        db.run(
            `INSERT INTO audit_logs (actor_email, actor_role, action, entity_type, entity_id, details, ip_address, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                actorEmail || "system",
                actorRole || "SYSTEM",
                action,
                entityType,
                String(entityId),
                typeof details === "string" ? details : JSON.stringify(details),
                ipAddress || "",
                new Date().toISOString()
            ]
        );
    } catch (err) {
        console.error("Audit log error:", err.message);
    }
}

module.exports = { logAudit };
