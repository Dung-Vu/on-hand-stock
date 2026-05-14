# Setup Authentication & Stocktake Database

Hướng dẫn thiết lập đăng nhập, phân quyền và kiểm kho dùng PostgreSQL.

## Tổng quan

Hệ thống hiện tại gồm:

- JWT authentication
- User roles: `admin`, `counter`
- User management qua `/api/auth/users`
- Stocktake sessions lưu trong PostgreSQL
- Lock/unlock phiếu kiểm kho nhiều người dùng

## Ports dùng trong dự án

- Frontend local: `http://localhost:5178`
- Backend API: `http://localhost:4001`
- WebSocket: `ws://localhost:4001/ws`
- Docker frontend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

## Setup nhanh

### 1. Cài dependencies

```bash
npm install
cd server
npm install
cd ..
```

### 2. Cấu hình environment

Tạo `server/.env.production`:

```bash
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://bonario:your_secure_password_here@postgres:5432/bonario_stock

JWT_SECRET=<JWT_SECRET>

ODOO_URL=https://bonario-vietnam.odoo.com
ODOO_DB=bonario-vietnam
ODOO_API_ENDPOINT=https://bonario-vietnam.odoo.com/jsonrpc
ODOO_API_KEY=your_odoo_api_key_here
PORT=4001
```

### 3. Chạy Docker

```bash
docker-compose up -d --build
```

Hoặc chạy local:

```bash
psql -U postgres -d bonario_stock -f database/init.sql

cd server
npm run dev

cd ..
npm run dev
```

## Tài khoản mặc định

Schema SQL hiện seed sẵn:

- Username: `dinhdung533`
- Password: `<ADMIN_PASSWORD>`
- Role: `admin`

Nếu dùng `npm run seed` trong `server/`, script cũng tạo đúng tài khoản mặc định này nếu chưa tồn tại.

## API chính

### Authentication

```bash
POST http://localhost:4001/api/auth/login
{
  "username": "dinhdung533",
  "password": "<ADMIN_PASSWORD>"
}
```

```bash
GET http://localhost:4001/api/auth/me
Authorization: Bearer <token>
```

### User management

```bash
GET http://localhost:4001/api/auth/users
Authorization: Bearer <token>
```

```bash
POST http://localhost:4001/api/auth/users
Authorization: Bearer <token>
{
  "username": "newuser",
  "password": "password123",
  "role": "counter"
}
```

```bash
PUT http://localhost:4001/api/auth/users/:id
Authorization: Bearer <token>
```

```bash
DELETE http://localhost:4001/api/auth/users/:id
Authorization: Bearer <token>
```

### Stocktake

```bash
GET http://localhost:4001/api/stocktake/sessions
```

```bash
GET http://localhost:4001/api/stocktake/sessions/by-month-warehouse?month=2026-03&warehouse=BONAP/Stock
```

```bash
POST http://localhost:4001/api/stocktake/sessions
{
  "month": "2026-03",
  "warehouse": "BONAP/Stock"
}
```

```bash
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
```

```bash
POST http://localhost:4001/api/stocktake/sessions/1/lock
POST http://localhost:4001/api/stocktake/sessions/1/unlock
```

## Hành vi hiện tại của stocktake

- Dữ liệu phiếu kiểm kho lưu ở PostgreSQL
- Nhiều người dùng thấy cùng một phiên kiểm kho
- UI web không còn dùng `localStorage` để lưu line items của phiếu
- `localStorage` chỉ còn có thể được dùng cho vài preference UI cục bộ, không phải nguồn dữ liệu kiểm kho

## Troubleshooting

### Không login được

- Kiểm tra backend đang chạy ở `4001`
- Kiểm tra `JWT_SECRET`
- Kiểm tra user còn `is_active = true`

### Không lưu được phiếu kiểm kho

- Kiểm tra PostgreSQL đang chạy
- Kiểm tra `DATABASE_URL`
- Kiểm tra schema đã được import từ [database/init.sql](./database/init.sql)

### Kiểm tra backend

```bash
docker-compose logs -f backend
```

```bash
curl http://localhost:4001/api/health
```

## Reset tài khoản mặc định

Nếu muốn tạo lại tài khoản mặc định bằng script:

```bash
cd server
npm run seed
```

Script sẽ chỉ tạo user nếu username chưa tồn tại.
