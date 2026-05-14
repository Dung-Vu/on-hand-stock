-- ============================================
-- Bonario Stock Management Database Schema
-- ============================================

-- Enable UUID extension (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'counter' CHECK (role IN ('admin', 'counter')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id)
);

-- Index for login lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- ============================================
-- STOCKTAKE SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS stocktake_sessions (
    id SERIAL PRIMARY KEY,
    month VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'), -- YYYY-MM format
    warehouse VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'locked', 'completed')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    completed_by INTEGER REFERENCES users(id),
    notes TEXT,
    UNIQUE(month, warehouse) -- One session per month per warehouse
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_month ON stocktake_sessions(month);
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_warehouse ON stocktake_sessions(warehouse);
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_status ON stocktake_sessions(status);
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_created_by ON stocktake_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_month_warehouse ON stocktake_sessions(month, warehouse);

-- ============================================
-- STOCKTAKE LINES
-- ============================================
CREATE TABLE IF NOT EXISTS stocktake_lines (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    system_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
    counted_qty DECIMAL(12,3),
    variance DECIMAL(12,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
    note TEXT,
    counted_by INTEGER REFERENCES users(id),
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, product_id) -- One line per product per session
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stocktake_lines_session_id ON stocktake_lines(session_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_lines_product_id ON stocktake_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_lines_counted_by ON stocktake_lines(counted_by);
CREATE INDEX IF NOT EXISTS idx_stocktake_lines_session_product ON stocktake_lines(session_id, product_id);

-- ============================================
-- AUDIT LOG (optional, for tracking changes)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- LOGIN, LOGOUT, CREATE_SESSION, UPDATE_LINE, LOCK_SESSION, etc.
    entity_type VARCHAR(50), -- 'user', 'stocktake_session', 'stocktake_line'
    entity_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to stocktake_sessions table
DROP TRIGGER IF EXISTS update_stocktake_sessions_updated_at ON stocktake_sessions;
CREATE TRIGGER update_stocktake_sessions_updated_at
    BEFORE UPDATE ON stocktake_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to stocktake_lines table
DROP TRIGGER IF EXISTS update_stocktake_lines_updated_at ON stocktake_lines;
CREATE TRIGGER update_stocktake_lines_updated_at
    BEFORE UPDATE ON stocktake_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT ADMIN USER
-- ============================================
-- No default admin password is stored in source control.
-- Set ADMIN_PASSWORD and run the seed script to create the first admin.

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE users IS 'User accounts for stocktake system';
COMMENT ON TABLE stocktake_sessions IS 'Monthly stocktake sessions per warehouse';
COMMENT ON TABLE stocktake_lines IS 'Individual product counts within stocktake sessions';
COMMENT ON TABLE audit_log IS 'Audit trail for user actions';

COMMENT ON COLUMN stocktake_sessions.month IS 'Month in YYYY-MM format';
COMMENT ON COLUMN stocktake_sessions.status IS 'draft, in_progress, locked, completed';
COMMENT ON COLUMN stocktake_lines.variance IS 'Auto-calculated: counted_qty - system_qty';

-- ============================================
-- GRANT PERMISSIONS (if using role-based DB access)
-- ============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bonario;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bonario;
