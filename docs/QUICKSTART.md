# Quickstart

## Cài dependencies

```bash
npm install
cd server
npm install
cd ..
```

## Chạy local

Tạo cấu hình:

```bash
cp server/.env.example server/.env
```

Khởi tạo database nếu chưa có:

```bash
psql -U postgres -d bonario_stock -f database/init.sql
```

Chạy backend:

```bash
cd server
npm run dev
```

Chạy frontend ở terminal khác:

```bash
npm run dev
```

Mặc định:

- Frontend: `http://localhost:5178`
- Backend: `http://localhost:4001`
- WebSocket: `ws://localhost:4001/ws`

## Chạy Docker

```bash
cp server/.env.example server/.env.production
docker-compose up -d --build
```

Mặc định:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:4001`
- PostgreSQL: `localhost:5432`

## Đăng nhập

Tài khoản seed:

- Username: `dinhdung533`
- Password: giá trị `ADMIN_PASSWORD`

Đổi mật khẩu sau lần đăng nhập đầu tiên nếu dùng môi trường thật.

## Kiểm tra trước khi push

```bash
npm run build
npm audit --audit-level=high
cd server
npm audit --audit-level=high
```
