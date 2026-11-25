const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const { requestLogger } = require("./middleware/logger");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const bookingRoutes = require("./routes/bookings");
const shipmentRoutes = require("./routes/shipments");
const dispatchRoutes = require("./routes/dispatch");
const fleetRoutes = require("./routes/fleet");
const customerRoutes = require("./routes/customers");
const billingRoutes = require("./routes/billing");
const analyticsRoutes = require("./routes/analytics");
const settingsRoutes = require("./routes/settings");

function createApp() {
    const app = express();

    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false
        })
    );
    app.use(express.json({ limit: "1mb" }));
    app.use(cookieParser());
    app.use(requestLogger);

    // Health check endpoint for Render / load balancers
    app.get("/api/health", (req, res) => {
        res.json({ status: "ok", service: "SmartLogix Enterprise LMS", timestamp: new Date().toISOString() });
    });

    // API Routes
    app.use("/api/auth", authRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/bookings", bookingRoutes);
    app.use("/api/shipments", shipmentRoutes);
    app.use("/api/dispatch", dispatchRoutes);
    app.use("/api/fleet", fleetRoutes);
    app.use("/api/customers", customerRoutes);
    app.use("/api/billing", billingRoutes);
    app.use("/api/analytics", analyticsRoutes);
    app.use("/api/settings", settingsRoutes);

    // Unknown API routes return clean JSON 404
    app.use("/api", (req, res) => {
        res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
    });

    // Static frontend assets (preserving original static directory)
    const staticDir = path.join(__dirname, "main", "resources", "static");
    app.use(express.static(staticDir));

    app.use(errorHandler);
    return app;
}

module.exports = { createApp };
