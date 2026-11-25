const config = require("./src/config");
const { initDatabase, closeDatabase } = require("./src/db/database");
const { seedEnterpriseData } = require("./src/db/seed");
const { createApp } = require("./src/app");

async function start() {
    await initDatabase(config.DB_PATH);
    seedEnterpriseData();

    const app = createApp();
    const server = app.listen(config.PORT, () => {
        console.log(`SmartLogix Enterprise LMS running at http://localhost:${config.PORT} (${config.NODE_ENV})`);
    });

    const shutdown = () => {
        console.log("Shutting down SmartLogix server gracefully...");
        server.close(() => {
            closeDatabase();
            process.exit(0);
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

start().catch((err) => {
    console.error("Failed to start SmartLogix server:", err);
    process.exit(1);
});
