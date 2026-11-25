const jwt = require("jsonwebtoken");
const config = require("../config");
const db = require("../db/database");

const COOKIE_NAME = "smartlogix_token";

function signToken(user) {
    return jwt.sign(
        {
            userId: user.user_id,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            customerId: user.customer_id || null,
            driverId: user.driver_id || null
        },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
    );
}

function extractToken(req) {
    if (req.cookies && req.cookies[COOKIE_NAME]) {
        return req.cookies[COOKIE_NAME];
    }
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7).trim();
    }
    return null;
}

function authenticate(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ message: "Authentication required. Please sign in." });
    }
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = db.get(
            "SELECT user_id, full_name, email, role, phone, customer_id, driver_id, active FROM users WHERE user_id = ?",
            [decoded.userId]
        );
        if (!user || !user.active) {
            return res.status(401).json({ message: "Session is invalid or account is disabled." });
        }
        req.user = {
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            customerId: user.customer_id,
            driverId: user.driver_id
        };
        return next();
    } catch (err) {
        return res.status(401).json({ message: "Session expired or invalid token. Please sign in again." });
    }
}

function optionalAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) return next();
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = db.get(
            "SELECT user_id, full_name, email, role, phone, customer_id, driver_id, active FROM users WHERE user_id = ?",
            [decoded.userId]
        );
        if (user && user.active) {
            req.user = {
                userId: user.user_id,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                customerId: user.customer_id,
                driverId: user.driver_id
            };
        }
    } catch (_) {
        // ignore invalid optional token
    }
    return next();
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied. Required role: ${allowedRoles.join(", ")}.`
            });
        }
        return next();
    };
}

module.exports = {
    COOKIE_NAME,
    signToken,
    authenticate,
    optionalAuth,
    authorize
};
