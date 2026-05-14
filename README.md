# Bonario Stock

Ứng dụng quản lý tồn kho và kiểm kho cho Bonario.

## Thành phần

- Web frontend: Vite + JavaScript.
- Backend API: Express, PostgreSQL, JWT auth, WebSocket.
- Cache tùy chọn: Redis.
- Mobile app: thư mục `mobile/`.

## Chức năng chính

- Tra cứu tồn kho theo kho, category và từ khóa.
- Xem hàng incoming và fabric products.
- Kiểm kho theo `tháng + kho`.
- Lưu phiếu kiểm kho vào PostgreSQL.
- Lock, unlock và complete phiếu kiểm kho.
- Quản lý user theo role `admin` và `counter`.
- Export CSV, Excel và PDF.

## Ports mặc định

| Dịch vụ | Port |
| --- | --- |
| Frontend dev | `5178` |
| Backend API | `4001` |
| WebSocket | `4001/ws` |
| Docker frontend | `8080` |
| PostgreSQL | `5432` |

## Chạy local

```bash
npm install
cd server
npm install
cd ..
```

Tạo file cấu hình từ mẫu:

```bash
cp server/.env.example server/.env
```

Khởi tạo database rồi chạy backend và frontend:

```bash
psql -U postgres -d bonario_stock -f database/init.sql

cd server
npm run dev

cd ..
npm run dev
```

## Chạy Docker

```bash
cp server/.env.example server/.env.production
docker-compose up -d --build
```

Sau khi chạy:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:4001`
- Health check: `http://localhost:4001/api/health`

## Tài liệu

- [Thiết lập auth và stocktake](./SETUP-AUTH.md)
- [Quickstart](./docs/QUICKSTART.md)
- [Port guide](./docs/PORT-GUIDE.md)
- [Cấu trúc repo](./FOLDER-STRUCTURE.md)

## Ghi chú bảo mật

- Không commit `.env`, `credentials.json`, token, password hoặc private key.
- Lockfile được track để CI và môi trường deploy cài đúng dependency.
- Tài khoản seed dùng `ADMIN_PASSWORD`; đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
