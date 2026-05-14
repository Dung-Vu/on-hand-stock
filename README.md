# Bonario Stock

Web app quản lý tồn kho và kiểm kho cho Bonario.

## Stack

| Phần | Công nghệ |
| --- | --- |
| Web | Vite, JavaScript |
| API | Express, PostgreSQL, JWT |
| Realtime | WebSocket |
| Cache | Redis tùy chọn |
| Mobile | React Native trong `mobile/` |

## Chức năng

- Tra cứu tồn kho theo kho, category và từ khóa.
- Xem hàng incoming và fabric products.
- Kiểm kho theo `tháng + kho`.
- Lưu, lock, unlock và complete phiếu kiểm kho.
- Quản lý user theo role `admin` và `counter`.
- Export CSV, Excel và PDF.

## Chạy nhanh

```bash
npm install
cd server && npm install && cd ..
cp server/.env.example server/.env
cd server && npm run db:init && cd ..
```

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
npm run dev
```

Docker:

```bash
cp server/.env.example server/.env.production
docker-compose up -d --build
```

## Ports

| Dịch vụ | URL |
| --- | --- |
| Frontend dev | `http://localhost:5178` |
| Backend API | `http://localhost:4001` |
| WebSocket | `ws://localhost:4001/ws` |
| Docker frontend | `http://localhost:8080` |
| Health check | `http://localhost:4001/api/health` |

## Tài liệu

- [Setup auth, database và stocktake](./docs/SETUP.md)
- [Port guide](./docs/PORTS.md)
- [Scripts](./scripts/README.md)

## Trước khi push

```bash
npm run build
npm audit --audit-level=high
cd server
npm audit --audit-level=high
```

## Không commit

- `.env`, `server/.env`, token, password, private key.
- `credentials.json` và credentials Cloudflare.
- `node_modules/`, `dist/`, `.venv/`, log, file tạm.
