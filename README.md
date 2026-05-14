# Bonario Stock Management

Ứng dụng tra cứu tồn kho và kiểm kho hàng tháng cho Bonario.

## Thành phần chính

- Frontend web: Vite + vanilla JS
- Backend API: Express
- Database: PostgreSQL
- Realtime stock updates: WebSocket
- Mobile app: React Native trong thư mục `mobile/`

## Tính năng hiện tại

- Tra cứu onhand theo kho, category, search
- Kiểm kho theo tháng/kho
- Lưu phiếu kiểm kho vào PostgreSQL
- Lock/unlock phiếu kiểm kho
- Quản lý user bằng JWT + role
- Export CSV / Excel

## Ports chuẩn

- Frontend local dev: `http://localhost:5178`
- Backend local dev: `http://localhost:4001`
- WebSocket local dev: `ws://localhost:4001/ws`
- Docker frontend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

## Chạy bằng Docker

```bash
cp server/.env.example server/.env.production
# chỉnh lại biến môi trường nếu cần

docker-compose up -d --build
```

Truy cập:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:4001`
- Health check: `http://localhost:4001/api/health`

Tài khoản seed mặc định:

- Username: `dinhdung533`
- Password: `<ADMIN_PASSWORD>`

## Chạy local

```bash
# cài dependencies
npm install
cd server
npm install
cd ..

# chạy postgres local nếu chưa có
docker run -d --name postgres ^
  -e POSTGRES_PASSWORD=<POSTGRES_PASSWORD> ^
  -e POSTGRES_DB=bonario_stock ^
  -p 5432:5432 ^
  postgres:16-alpine

# khởi tạo schema + seed user mặc định
psql -U postgres -d bonario_stock -f database/init.sql

# chạy backend
cd server
npm run dev

# terminal khác: chạy frontend
cd ..
npm run dev
```

## Tài liệu

- [SETUP-AUTH.md](./SETUP-AUTH.md)
- [docs/QUICKSTART.md](./docs/QUICKSTART.md)
- [docs/PORT-GUIDE.md](./docs/PORT-GUIDE.md)

## Cấu trúc thư mục

```text
onhand-stock-v1/
├── src/                 # Frontend web
├── server/              # Express API + WebSocket + auth + stocktake
├── database/            # PostgreSQL schema và seed SQL
├── docs/                # Tài liệu vận hành
├── mobile/              # React Native app
└── scripts/             # Script tiện ích
```

## Ghi chú

- UI kiểm kho web hiện lưu phiếu vào PostgreSQL, không còn dùng `localStorage` cho dữ liệu phiếu.
- API quản lý user dùng namespace `/api/auth/users`.
- Docker và local dev đều mặc định backend ở port `4001`.
