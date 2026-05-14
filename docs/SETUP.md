# Setup

Tài liệu setup backend, auth và stocktake.

## Environment

Tạo `server/.env` khi chạy local hoặc `server/.env.production` khi chạy Docker:

```env
PORT=4001
DATABASE_URL=postgresql://bonario:<POSTGRES_PASSWORD>@localhost:5432/bonario_stock
JWT_SECRET=<JWT_SECRET>
ADMIN_PASSWORD=<ADMIN_PASSWORD>

ODOO_URL=https://bonario-vietnam.odoo.com
ODOO_DB=bonario-vietnam
ODOO_API_ENDPOINT=https://bonario-vietnam.odoo.com/jsonrpc
ODOO_API_KEY=<ODOO_API_KEY>

REDIS_URL=redis://localhost:6379
```

Không đưa secret thật vào Git.

## Database

```bash
psql -U postgres -d bonario_stock -f database/init.sql
```

Seed admin nếu cần:

```bash
cd server
ADMIN_PASSWORD=<ADMIN_PASSWORD> npm run seed
```

Tài khoản seed:

- Username: `dinhdung533`
- Password: giá trị `ADMIN_PASSWORD`
- Role: `admin`

## Auth API

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "dinhdung533",
  "password": "<ADMIN_PASSWORD>"
}
```

```http
GET /api/auth/me
Authorization: Bearer <token>
```

```http
GET /api/auth/users
Authorization: Bearer <admin_token>
```

```http
POST /api/auth/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "counter01",
  "password": "strong_password",
  "role": "counter"
}
```

## Stocktake API

```http
GET /api/stocktake/sessions?month=2026-05&warehouse=Kho%20A
Authorization: Bearer <token>
```

```http
GET /api/stocktake/sessions/by-month-warehouse?month=2026-05&warehouse=Kho%20A
Authorization: Bearer <token>
```

```http
POST /api/stocktake/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "month": "2026-05",
  "warehouse": "Kho A"
}
```

```http
PUT /api/stocktake/sessions/:id/lines
Authorization: Bearer <token>
Content-Type: application/json

{
  "lines": [
    {
      "product_id": "P001",
      "product_name": "Product name",
      "system_qty": 10,
      "counted_qty": 9,
      "note": "Short note"
    }
  ]
}
```
