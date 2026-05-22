// backend/utils/db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

function databaseConfig() {
    const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
    if (databaseUrl) {
        const url = new URL(databaseUrl);
        return {
            host: url.hostname,
            port: url.port ? Number(url.port) : 3306,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.replace(/^\//, ""),
        };
    }

    return {
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "jooust_db",
    };
}

const db = mysql.createPool({
    ...databaseConfig(),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

module.exports = db;
