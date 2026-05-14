// ============================================
// SEED SCRIPT
// Create default admin user
// ============================================

import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.production' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false, // Disable SSL for local Docker
});

async function seedAdmin() {
    const client = await pool.connect();

    try {
        console.log('🌱 Seeding admin user...');

        // Check if default admin already exists
        const existingAdmin = await client.query(
            'SELECT id FROM users WHERE username = $1',
            ['dinhdung533']
        );

        if (existingAdmin.rows.length > 0) {
            console.log('✅ Default admin user already exists');
            return;
        }

        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            throw new Error('ADMIN_PASSWORD environment variable is required to seed the admin user');
        }

        // Create admin user
        const passwordHash = await bcrypt.hash(adminPassword, 10);

        const result = await client.query(
            `INSERT INTO users (username, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, role, created_at`,
            ['dinhdung533', passwordHash, 'admin', true]
        );

        console.log('✅ Admin user created successfully:');
        console.log('   Username: dinhdung533');
        console.log('   Password: set via ADMIN_PASSWORD');
        console.log('   Role: admin');
        console.log('');
        console.log('⚠️  PLEASE CHANGE THE DEFAULT PASSWORD AFTER FIRST LOGIN!');

    } catch (error) {
        console.error('❌ Error seeding admin user:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    try {
        await seedAdmin();
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
