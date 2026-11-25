function requestLogger(req, res, next) {
    const start = Date.now();
    res.on("finish", () => {
        if (req.path.startsWith("/api/")) {
            const ms = Date.now() - start;
            const actor = req.user ? `${req.user.email} (${req.user.role})` : "anonymous";
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms - ${actor}`);
        }
    });
    next();
}

module.exports = { requestLogger };
