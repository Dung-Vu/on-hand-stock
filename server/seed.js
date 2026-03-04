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
        
        // Check if admin already exists
        const existingAdmin = await client.query(
            'SELECT id FROM users WHERE username = $1',
            ['admin']
        );
        
        if (existingAdmin.rows.length > 0) {
            console.log('✅ Admin user already exists');
            return;
        }
        
        // Create admin user
        const passwordHash = await bcrypt.hash('admin123', 10);
        
        const result = await client.query(
            `INSERT INTO users (username, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, role, created_at`,
            ['admin', passwordHash, 'admin', true]
        );
        
        console.log('✅ Admin user created successfully:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
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