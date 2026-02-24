"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
const pg_1 = require("pg");
const env_1 = require("./env");
exports.pool = new pg_1.Pool({
    host: env_1.DB_CONFIG.host,
    port: env_1.DB_CONFIG.port,
    user: env_1.DB_CONFIG.user,
    password: env_1.DB_CONFIG.password,
    database: env_1.DB_CONFIG.database
});
async function query(text, params) {
    const client = await exports.pool.connect();
    try {
        const res = await client.query(text, params);
        return { rows: res.rows };
    }
    finally {
        client.release();
    }
}
