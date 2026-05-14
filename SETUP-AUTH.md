# Thiết Lập Auth Và Stocktake

Tài liệu này mô tả phần đăng nhập, phân quyền và lưu phiếu kiểm kho bằng PostgreSQL.

## Tổng quan

- JWT authentication.
- Role: `admin`, `counter`.
- User management: `/api/auth/users`.
- Stocktake sessions lưu theo `month + warehouse`.
- Mỗi phiếu có trạng thái `draft`, `in_progress`, `locked`, `completed`.

## Biến môi trường backend

Tạo `server/.env` khi chạy local hoặc `server/.env.production` khi chạy Docker:

```env
PORT=4001
DATABASE_URL=postgresql://bonario:your_password@localhost:5432/bonario_stock
JWT_SECRET=replace_with_a_long_random_secret
ADMIN_PASSWORD=replace_with_initial_admin_password

ODOO_URL=https://bonario-vietnam.odoo.com
ODOO_DB=bonario-vietnam
ODOO_API_ENDPOINT=https://bonario-vietnam.odoo.com/jsonrpc
ODOO_API_KEY=<ODOO_API_KEY>

REDIS_URL=redis://localhost:6379
```

Không commit file `.env` hoặc secret thật.

## Khởi tạo database

```bash
psql -U postgres -d bonario_stock -f database/init.sql
```

Nếu cần tạo admin bằng script:

```bash
cd server
ADMIN_PASSWORD=your_password npm run seed
```

Tài khoản seed mặc định:

- Username: `dinhdung533`
- Password: giá trị `ADMIN_PASSWORD`
- Role: `admin`

## API auth chính

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

## API stocktake chính

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

## Kiểm tra nhanh

```bash
cd server
npm run dev
```

```bash
curl http://localhost:4001/api/health
```

Các thay đổi liên quan auth/stocktake nên được kiểm bằng:

```bash
npm run build
cd server
npm audit --audit-level=high
```
