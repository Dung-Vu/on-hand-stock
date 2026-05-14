# Port Guide

## Ports mặc định

| Thành phần | Port/path |
| --- | --- |
| Frontend local dev | `5178` |
| Backend API | `4001` |
| WebSocket | `4001/ws` |
| Docker frontend | `8080` |
| PostgreSQL | `5432` |

## URLs local

- Web app: `http://localhost:5178`
- API: `http://localhost:4001`
- WebSocket: `ws://localhost:4001/ws`

## URLs Docker

- Web app qua nginx: `http://localhost:8080`
- API: `http://localhost:4001`
- PostgreSQL: `localhost:5432`

## File cấu hình liên quan

- [vite.config.js](../vite.config.js)
- [server/index.js](../server/index.js)
- [src/config.js](../src/config.js)
- [src/services/api.js](../src/services/api.js)
- [src/services/apiClient.js](../src/services/apiClient.js)
- [src/services/websocket.js](../src/services/websocket.js)
- [docker-compose.yml](../docker-compose.yml)

## Kiểm tra port

```bash
npm run check-ports
```

```powershell
npm run check-ports:ps1
```

Hoặc dùng lệnh Windows:

```powershell
netstat -ano | findstr ":5178"
netstat -ano | findstr ":4001"
netstat -ano | findstr ":8080"
netstat -ano | findstr ":5432"
```

## Khi đổi port

- Frontend local: cập nhật `vite.config.js`.
- Backend: cập nhật biến môi trường `PORT`.
- Docker frontend public port: cập nhật `docker-compose.yml`.

Nếu đổi backend port, cập nhật đồng bộ client API, WebSocket và tài liệu vận hành.
