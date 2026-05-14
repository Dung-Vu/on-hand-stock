# Quick Start

## Chạy ứng dụng

### Docker

```bash
docker-compose up -d --build
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:4001`

### Local dev

```bash
cd server
npm install
npm run dev

cd ..
npm install
npm run dev
```

- Frontend local: `http://localhost:5178`
- Backend local: `http://localhost:4001`

## Đăng nhập

Dùng tài khoản seed mặc định:

- Username: `dinhdung533`
- Password: `<ADMIN_PASSWORD>`

## Luồng sử dụng cơ bản

1. Mở web và đăng nhập.
2. Bấm tải dữ liệu tồn kho.
3. Chọn tab kho cần xem.
4. Tìm kiếm hoặc lọc theo category.
5. Vào màn `Kiểm kho` để nhập số thực tế theo tháng/kho.
6. Chốt phiếu khi hoàn tất.
7. Xuất CSV hoặc Excel nếu cần.

## Ghi chú vận hành

- Dữ liệu kiểm kho hiện lưu trong PostgreSQL.
- Phiếu kiểm kho được chia theo `tháng + kho`.
- API user management dùng `/api/auth/users`.
- WebSocket local dùng `ws://localhost:4001/ws`.
