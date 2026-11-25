function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 30, message = "Too many requests. Please try again later." } = {}) {
    const hits = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits.entries()) {
            if (now > entry.resetAt) hits.delete(key);
        }
    }, Math.min(windowMs, 60000)).unref();

    return (req, res, next) => {
        const key = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            return res.status(429).json({ message });
        }
        return next();
    };
}

module.exports = { createRateLimiter };
