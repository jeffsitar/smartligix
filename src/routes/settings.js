const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/database");
const config = require("../config");
const { authenticate, authorize } = require("../middleware/auth");
const { logAudit } = require("../services/auditService");

const router = express.Router();

router.get("/", authenticate, (req, res) => {
    const rows = db.all("SELECT setting_key, setting_value FROM settings");
    const out = {};
    for (const r of rows) out[r.setting_key] = r.setting_value;
    return res.json(out);
});

router.put("/", authenticate, authorize("ADMIN"), (req, res) => {
    const body = req.body || {};
    const allowedKeys = [
        "company_name",
        "company_gstin",
        "company_address",
        "support_email",
        "support_phone",
        "base_rate",
        "per_kg_rate",
        "fuel_surcharge_pct",
        "gst_pct",
        "payment_terms_days"
    ];
    const nowIso = new Date().toISOString();

    db.transaction(() => {
        for (const key of allowedKeys) {
            if (body[key] !== undefined) {
                db.run(
                    `INSERT INTO settings (setting_key, setting_value, updated_at)
                     VALUES (?, ?, ?)
                     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`,
                    [key, String(body[key]).trim(), nowIso]
                );
            }
        }
    });

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "SETTINGS_UPDATED",
        entityType: "SETTINGS",
        details: "Updated company & pricing rules",
        ipAddress: req.ip
    });

    return res.json({ message: "Operational settings saved successfully." });
});

router.get("/users", authenticate, authorize("ADMIN"), (req, res) => {
    const users = db.all(
        `SELECT user_id AS userId, full_name AS fullName, email, role, phone, active, created_at AS createdAt
         FROM users ORDER BY user_id ASC`
    );
    return res.json(users);
});

router.post("/users", authenticate, authorize("ADMIN"), (req, res) => {
    const body = req.body || {};
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim().toUpperCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");

    if (!fullName || !email || !Object.values(config.ROLES).includes(role) || password.length < 6) {
        return res.status(400).json({ message: "Valid name, email, role, and password (min 6 chars) are required." });
    }

    const exists = db.get("SELECT user_id FROM users WHERE LOWER(email) = ?", [email]);
    if (exists) return res.status(409).json({ message: "A user with this email already exists." });

    const r = db.run(
        `INSERT INTO users (full_name, email, password_hash, role, phone, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [fullName, email, bcrypt.hashSync(password, 10), role, phone, new Date().toISOString()]
    );

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: email,
        details: `Role: ${role}`,
        ipAddress: req.ip
    });

    return res.status(201).json({ message: "User account created.", userId: r.lastInsertRowid });
});

router.patch("/users/:userId/toggle", authenticate, authorize("ADMIN"), (req, res) => {
    const userId = Number(req.params.userId);
    if (userId === req.user.userId) {
        return res.status(400).json({ message: "You cannot deactivate your own admin account." });
    }
    const target = db.get("SELECT * FROM users WHERE user_id = ?", [userId]);
    if (!target) return res.status(404).json({ message: "User not found." });

    const nextActive = target.active ? 0 : 1;
    db.run("UPDATE users SET active = ? WHERE user_id = ?", [nextActive, userId]);

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: nextActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        entityType: "USER",
        entityId: target.email,
        ipAddress: req.ip
    });

    return res.json({ message: `User ${target.email} ${nextActive ? "activated" : "deactivated"}.`, active: !!nextActive });
});

module.exports = router;
