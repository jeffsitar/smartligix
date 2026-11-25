const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/database");
const config = require("../config");
const { COOKIE_NAME, signToken, authenticate } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimit");
const { logAudit } = require("../services/auditService");

const router = express.Router();
const authLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 40,
    message: "Too many authentication attempts. Please wait a few minutes."
});

function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.NODE_ENV === "production",
        maxAge: 12 * 60 * 60 * 1000
    });
}

router.post("/login", authLimiter, (req, res) => {
    const email = req.body && req.body.email != null ? String(req.body.email).trim().toLowerCase() : "";
    const password = req.body && req.body.password != null ? String(req.body.password) : "";

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    const user = db.get("SELECT * FROM users WHERE LOWER(email) = ?", [email]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        logAudit({
            actorEmail: email,
            actorRole: "ANONYMOUS",
            action: "LOGIN_FAILED",
            entityType: "AUTH",
            details: "Invalid credentials",
            ipAddress: req.ip
        });
        return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.active) {
        return res.status(403).json({ message: "This account has been deactivated. Contact an administrator." });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    logAudit({
        actorEmail: user.email,
        actorRole: user.role,
        action: "LOGIN_SUCCESS",
        entityType: "AUTH",
        entityId: user.user_id,
        details: "User signed in",
        ipAddress: req.ip
    });

    return res.status(200).json({
        message: "Login successful",
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        customerId: user.customer_id,
        driverId: user.driver_id
    });
});

router.post("/register", authLimiter, (req, res) => {
    const body = req.body || {};
    const fullName = String(body.fullName || "").trim();
    const companyName = String(body.companyName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const password = String(body.password || "");

    if (!fullName || !email || !phone || !address || password.length < 6) {
        return res.status(400).json({
            message: "Full name, email, phone, address, and a password (min 6 characters) are required."
        });
    }

    const existing = db.get("SELECT user_id FROM users WHERE LOWER(email) = ?", [email]);
    if (existing) {
        return res.status(409).json({ message: "An account with this email already exists." });
    }

    const nowIso = new Date().toISOString();
    const result = db.transaction(() => {
        const cRes = db.run(
            `INSERT INTO customers (customer_name, company_name, phone, email, address, city, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [fullName, companyName || fullName, phone, email, address, "Mumbai", nowIso]
        );
        const uRes = db.run(
            `INSERT INTO users (full_name, email, password_hash, role, phone, customer_id, active, created_at)
             VALUES (?, ?, ?, 'CUSTOMER', ?, ?, 1, ?)`,
            [fullName, email, bcrypt.hashSync(password, 10), phone, cRes.lastInsertRowid, nowIso]
        );
        return { userId: uRes.lastInsertRowid, customerId: cRes.lastInsertRowid };
    });

    const user = db.get("SELECT * FROM users WHERE user_id = ?", [result.userId]);
    const token = signToken(user);
    setAuthCookie(res, token);

    logAudit({
        actorEmail: user.email,
        actorRole: "CUSTOMER",
        action: "CUSTOMER_REGISTERED",
        entityType: "USER",
        entityId: user.user_id,
        details: `Self-registered customer account (${companyName || fullName})`,
        ipAddress: req.ip
    });

    return res.status(201).json({
        message: "Account created successfully",
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        customerId: user.customer_id
    });
});

router.post("/logout", authenticate, (req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax" });
    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "LOGOUT",
        entityType: "AUTH",
        entityId: req.user.userId,
        ipAddress: req.ip
    });
    return res.json({ message: "Signed out successfully." });
});

router.get("/me", authenticate, (req, res) => {
    return res.json(req.user);
});

module.exports = router;
