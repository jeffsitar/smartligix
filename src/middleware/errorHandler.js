function errorHandler(err, req, res, next) {
    if (err && err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON payload." });
    }
    console.error("[ERROR]", err);
    const status = err.statusCode || 500;
    return res.status(status).json({
        message: err.expose ? err.message : "An unexpected internal server error occurred."
    });
}

module.exports = { errorHandler };
