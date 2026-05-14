# Port Guide

## Port chuẩn hiện tại

- Frontend local dev: `5178`
- Backend API local/dev: `4001`
- WebSocket local/dev: `4001` trên path `/ws`
- Docker frontend: `8080`
- PostgreSQL: `5432`

## Mapping theo môi trường

### Local development

- Web app: `http://localhost:5178`
- API: `http://localhost:4001`
- WebSocket: `ws://localhost:4001/ws`

### Docker

- Frontend qua nginx: `http://localhost:8080`
- Backend container: `http://localhost:4001`
- PostgreSQL: `localhost:5432`

## File cấu hình liên quan

- [vite.config.js](../vite.config.js)
- [server/index.js](../server/index.js)
- [src/config.js](../src/config.js)
- [src/services/apiClient.js](../src/services/apiClient.js)
- [src/services/websocket.js](../src/services/websocket.js)
- [docker-compose.yml](../docker-compose.yml)

## Kiểm tra port

```powershell
netstat -ano | findstr ":5178"
netstat -ano | findstr ":4001"
netstat -ano | findstr ":8080"
netstat -ano | findstr ":5432"
```

Hoặc dùng script:

```bash
npm run check-ports
```

```powershell
npm run check-ports:ps1
```

## Khi cần đổi port

- Frontend local: sửa [vite.config.js](../vite.config.js)
- Backend: sửa biến môi trường `PORT`
- Docker public web port: sửa [docker-compose.yml](../docker-compose.yml)

Nếu đổi backend port, cần cập nhật đồng bộ:

- `src/config.js`
- `src/services/api.js`
- `src/services/apiClient.js`
- `src/services/websocket.js`
- tài liệu vận hành liên quan
