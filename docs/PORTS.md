# Ports

| Thành phần | Port/path |
| --- | --- |
| Frontend dev | `5178` |
| Backend API | `4001` |
| WebSocket | `4001/ws` |
| Docker frontend | `8080` |
| PostgreSQL | `5432` |

## Kiểm tra

```bash
npm run check-ports
```

```powershell
npm run check-ports:ps1
netstat -ano | findstr ":4001"
```

## Khi đổi port

- Frontend dev: `vite.config.js`.
- Backend: biến môi trường `PORT`.
- Docker frontend: `docker-compose.yml`.
- Client API/WebSocket: `src/config.js`, `src/services/api.js`, `src/services/apiClient.js`, `src/services/websocket.js`.
