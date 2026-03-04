# 🔐 Setup Authentication & Database

Hướng dẫn thiết lập hệ thống đăng nhập và database cho tính năng kiểm kho.

## 📋 Tổng Quan

Hệ thống mới bao gồm:
- **PostgreSQL Database** - Lưu trữ users, stocktake sessions, stocktake lines
- **JWT Authentication** - Đăng nhập, phân quyền (admin vs counter)
- **Admin Dashboard** - Quản lý users (tạo, xóa, edit, activate/deactivate)
- **Sync Database** - Kiểm kho lưu database thay vì localStorage

## 🚀 Quick Start

### 1. Cài Đặt Dependencies

```bash
cd server
npm install
```

### 2. Cấu Hình Environment Variables

Tạo file `server/.env.production`:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://bonario:your_secure_password_here@postgres:5432/bonario_stock

# JWT Secret (change this!)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Odoo Configuration
ODOO_URL=https://bonario-vietnam.odoo.com
ODOO_DB=bonario-vietnam
ODOO_API_ENDPOINT=https://bonario-vietnam.odoo.com/jsonrpc
ODOO_API_KEY=your_odoo_api_key_here
```

### 3. Start Docker Services

```bash
# From project root
docker-compose down -v  # Remove old volumes (optional, for fresh start)
docker-compose up -d --build
```

### 4. Check Logs

```bash
# Check all services
docker-compose logs -f

# Check backend specifically
docker-compose logs -f backend

# Check postgres
docker-compose logs -f postgres
```

### 5. Access Application

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:4001
- **PostgreSQL:** localhost:5432

## 👤 Default Admin Account

- **Username:** `admin`
- **Password:** `admin123`

⚠️ **IMPORTANT:** Đổi mật khẩu ngay sau khi đăng nhập lần đầu!

## 📊 Database Schema

### Tables

1. **users** - User accounts
   - `id`, `username`, `password_hash`, `role` (admin/counter), `is_active`
   
2. **stocktake_sessions** - Monthly stocktake sessions
   - `id`, `month` (YYYY-MM), `warehouse`, `status`, `created_by`, `locked_at`, `completed_at`
   
3. **stocktake_lines** - Individual product counts
   - `id`, `session_id`, `product_id`, `system_qty`, `counted_qty`, `variance`, `note`
   
4. **audit_log** - User action tracking
   - `user_id`, `action`, `entity_type`, `entity_id`, `details`, `ip_address`

### Access Database

```bash
# Connect to PostgreSQL
docker exec -it bonario-postgres psql -U bonario -d bonario_stock

# List tables
\dt

# View users
SELECT * FROM users;

# View recent sessions
SELECT * FROM stocktake_sessions ORDER BY created_at DESC LIMIT 10;
```

## 🔑 API Endpoints

### Authentication

```bash
# Login
POST http://localhost:4001/api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

# Logout
POST http://localhost:4001/api/auth/logout
Authorization: Bearer <token>

# Get current user
GET http://localhost:4001/api/auth/me
Authorization: Bearer <token>

# List users (admin only)
GET http://localhost:4001/api/auth/users
Authorization: Bearer <token>

# Create user (admin only)
POST http://localhost:4001/api/auth/users
Authorization: Bearer <token>
{
  "username": "newuser",
  "password": "password123",
  "role": "counter"
}
```

### Stocktake

```bash
# List sessions
GET http://localhost:4001/api/stocktake/sessions

# Get session by month/warehouse
GET http://localhost:4001/api/stocktake/sessions/by-month-warehouse?month=2026-03&warehouse=BONAP/Stock

# Create session
POST http://localhost:4001/api/stocktake/sessions
{
  "month": "2026-03",
  "warehouse": "BONAP/Stock"
}

# Update lines
PUT http://localhost:4001/api/stocktake/sessions/1/lines
{
  "lines": [
    {
      "productId": 123,
      "productName": "Product A",
      "systemQty": 100,
      "countedQty": 98,
      "note": "Damaged"
    }
  ]
}

# Lock session
POST http://localhost:4001/api/stocktake/sessions/1/lock

# Unlock session
POST http://localhost:4001/api/stocktake/sessions/1/unlock
```

## 🎯 User Roles

### Admin (👑)
- Tạo, xem, edit, xóa users
- Tạo stocktake sessions
- Lock/unlock/complete sessions
- Xem tất cả sessions
- Export reports

### Counter (🔍)
- Xem danh sách sessions
- Count products (nhập số lượng thực tế)
- Thêm ghi chú
- Xem sessions đã tạo

## 🔄 Migration từ LocalStorage

Hệ thống cũ lưu dữ liệu kiểm kho trong localStorage → mỗi người dùng thấy dữ liệu khác nhau.

**Hệ thống mới:**
- Dữ liệu lưu PostgreSQL → đồng bộ cho tất cả người dùng
- Real-time sync (qua WebSocket - sẽ implement)
- Audit trail - biết ai count sản phẩm nào, lúc nào
- Session locking - tránh 2 người cùng edit 1 session

### Copy dữ liệu cũ (optional)

Nếu muốn migrate dữ liệu từ localStorage sang database:

```javascript
// Run in browser console
const keys = [];
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('stocktake:v1:')) {
        keys.push(key);
    }
}

const data = keys.map(key => ({
    key,
    value: JSON.parse(localStorage.getItem(key))
}));

console.log(JSON.stringify(data, null, 2));
// Send this to backend API to import
```

## 🛠️ Troubleshooting

### Lỗi: "Connection refused" khi connect database

```bash
# Check if postgres is running
docker-compose ps

# Restart postgres
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Lỗi: "Authentication failed"

- Kiểm tra JWT_SECRET trong .env
- Token hết hạn (24h) → logout và login lại
- User bị deactivate → admin cần activate lại

### Lỗi: "Database does not exist"

```bash
# Recreate database volume
docker-compose down -v
docker-compose up -d postgres
```

### Reset admin password

```bash
# Connect to database
docker exec -it bonario-postgres psql -U bonario -d bonario_stock

# Update password (password: admin123)
UPDATE users 
SET password_hash = '$2b$10$rH9zqX8FQJzKvVxN7pGwZeO8KqVxN7pGwZeO8KqVxN7pGwZeO8KqV'
WHERE username = 'admin';
```

## 📝 Next Steps

1. ✅ Setup database & authentication (DONE)
2. ⏳ Real-time sync via WebSocket
3. ⏳ Export reports từ database
4. ⏳ Backup database tự động
5. ⏳ Email notifications khi session được tạo/locked/completed

## 🔒 Security Best Practices

- ✅ Đổi JWT_SECRET thành random string dài
- ✅ Đổi admin password ngay sau khi setup
- ✅ Dùng HTTPS trong production
- ✅ Regular database backups
- ✅ Monitor audit logs
- ✅ Rate limiting đã enable (100 req/15min)

---

**Questions?** Check backend logs: `docker-compose logs -f backend`
