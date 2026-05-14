import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { config } from 'dotenv';

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../database/init.sql');

function getClientConfig() {
    if (process.env.DATABASE_URL) {
        return { connectionString: process.env.DATABASE_URL };
    }

    const config = {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'bonario_stock',
        user: process.env.PGUSER || 'postgres',
    };

    const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
    if (!password) {
        throw new Error('Set DATABASE_URL, PGPASSWORD, or POSTGRES_PASSWORD before running db:init.');
    }

    if (password) {
        config.password = password;
    }

    return config;
}

async function main() {
    const sql = await readFile(sqlPath, 'utf8');
    const client = new Client(getClientConfig());

    try {
        await client.connect();
        await client.query(sql);
        console.log(`Database initialized from ${sqlPath}`);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Failed to initialize database:', error.message);
    process.exitCode = 1;
});
