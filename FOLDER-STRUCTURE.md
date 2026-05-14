# Cấu Trúc Repo

```text
onhand-stock-v1/
├── .github/workflows/        # GitHub Actions
├── database/                 # PostgreSQL schema
├── docs/                     # Tài liệu vận hành
├── mobile/                   # React Native app
├── public/                   # PWA manifest và service worker
├── scripts/                  # Script hỗ trợ vận hành
├── server/                   # Express API, auth, DB, WebSocket
├── src/                      # Web frontend
├── docker-compose.yml        # Stack local/Docker
├── Dockerfile                # Frontend image
├── nginx.conf                # Nginx frontend/proxy
├── package.json              # Frontend dependencies/scripts
└── package-lock.json         # Frontend lockfile
```

## Frontend

```text
src/
├── components/               # UI components
├── services/                 # API và WebSocket clients
├── store/                    # State và business logic phía client
├── utils/                    # Export, retry, analytics, DOM helpers
├── App.js
├── config.js
├── main.js
└── style.css
```

## Backend

```text
server/
├── db/                       # PostgreSQL pool và helpers
├── middleware/               # Auth, HMAC, cache, validation
├── routes/                   # API routes
├── scripts/                  # Script kiểm tra backend
├── services/                 # Auth, Redis, stocktake logic
├── .env.example              # Mẫu cấu hình không chứa secret thật
├── Dockerfile
├── index.js                  # Express app entrypoint
├── package.json
└── package-lock.json
```

## Tài liệu

```text
docs/
├── README.md
├── QUICKSTART.md
└── PORT-GUIDE.md
```

## File không commit

Các file sau chỉ dùng local và phải nằm ngoài Git:

- `.env`, `.env.*`
- `server/.env`, `server/.env.*`
- `credentials.json`
- `node_modules/`
- `dist/`
- `.venv/`
- log và file tạm

## Quy ước

- Giữ code theo module hiện có, tránh refactor rộng khi không cần thiết.
- Dùng `npm run build` để kiểm frontend trước khi push.
- Dùng `npm audit --audit-level=high` để kiểm dependency rủi ro cao.
- Khi đổi port backend, cập nhật đồng bộ `src/config.js`, `src/services/api.js`, `src/services/apiClient.js`, `src/services/websocket.js` và docs.
