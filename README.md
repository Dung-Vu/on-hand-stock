# 📦 Hệ Thống Quản Lý Tồn Kho - Stock Inventory Management

Một hệ thống quản lý kho hiện đại và chuyên nghiệp, được xây dựng với Vite + Tailwind CSS, với giao diện thiết kế phong cách công nghệ.

## ✨ Tính Năng

### Core Features
- 🚀 **Tech Stack Hiện Đại**: Vite + Tailwind CSS
- 🎨 **Thiết Kế Công Nghệ**: Gradient background, glass effect, animations
- 📦 **Nhóm Theo Kho**: Tự động nhóm dữ liệu tồn kho theo kho
- 🏷️ **Nhóm Theo Danh Mục**: Trong mỗi kho, sản phẩm được nhóm theo danh mục
- 🔍 **Tìm Kiếm Thời Gian Thực**: Tìm kiếm tên sản phẩm và số lô
- 🎯 **Lọc Thông Minh**: Lọc dữ liệu theo kho và danh mục
- 📊 **Thông Tin Thống Kê**: Hiển thị real-time tổng số kho, sản phẩm và số lượng
- 📥 **Xuất Dữ Liệu**: Hỗ trợ xuất Excel, PDF, CSV
- 📱 **Responsive Design**: Hỗ trợ hoàn hảo desktop, tablet và mobile

### 🔐 Authentication & Database (NEW!)
- 👤 **JWT Authentication** - Đăng nhập với username/password
- 👑 **Role-Based Access** - Admin (quản lý users) vs Counter (chỉ kiểm kho)
- 🐘 **PostgreSQL Database** - Lưu trữ sessions kiểm kho, đồng bộ multi-user
- 🧾 **Monthly Stocktake** - Tạo phiếu kiểm kho theo tháng/kho
- 🔒 **Session Locking** - Chốt phiếu, tránh edit đồng thời
- 📊 **Audit Trail** - Theo dõi ai làm gì, khi nào
- 👥 **User Management** - Admin dashboard để tạo/quản lý users

## 🚀 Bắt Đầu Nhanh

### 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (cho local development)

### Option 1: Docker (Recommended)

```bash
# 1. Setup environment
cp server/.env.example server/.env.production
# Edit server/.env.production với config của bạn

# 2. Start all services
docker-compose up -d --build

# 3. Access application
# Frontend: http://localhost:8080
# Backend: http://localhost:4001
# Database: localhost:5432

# Default login:
# Username: admin
# Password: admin123
```

### Option 2: Local Development

```bash
# 1. Install dependencies
cd server && npm install
cd ../ && npm install

# 2. Setup PostgreSQL (local or Docker)
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=bonario \
  -e POSTGRES_DB=bonario_stock \
  -p 5432:5432 \
  postgres:16-alpine

# 3. Run database migrations
psql -U postgres -d bonario_stock -f database/init.sql

# 4. Start backend
cd server && npm run dev

# 5. Start frontend (new terminal)
npm run dev
```

### 📚 Documentation

- **[SETUP-AUTH.md](./SETUP-AUTH.md)** - Chi tiết setup authentication & database
- **[docs/QUICKSTART.md](./docs/QUICKSTART.md)** - Hướng dẫn sử dụng tính năng kiểm kho
- **[docs/PORT-GUIDE.md](./docs/PORT-GUIDE.md)** - Cấu hình ports

## 📁 Cấu Trúc Dự Án

```
onhand-stock-v1/
├── src/                  # Source code
│   ├── components/       # UI components (native JS)
│   │   ├── Header.js     # Header component
│   │   ├── Controls.js   # Control panel component
│   │   ├── StockData.js  # Stock data component
│   │   └── Tabs.js       # Tabs component
│   ├── store/            # Data store và business logic
│   │   └── dataStore.js  # Data management
│   ├── utils/            # Utility functions
│   │   └── dom.js        # DOM manipulation tools
│   ├── config.js         # API configuration
│   ├── App.js            # Main application component
│   ├── main.js           # Entry file
│   └── style.css         # Global styles
├── server/               # Backend API server
│   ├── index.js          # Express server
│   └── package.json      # Server dependencies
├── docs/                 # Documentation files
│   ├── QUICKSTART.md     # Quick start guide
│   ├── PORT-GUIDE.md     # Port configuration guide
│   ├── PILLOW-PRODUCTS-LIST.md
│   └── PILLOW-PRODUCTS-ORD-WAREHOUSES.md
├── scripts/              # Utility scripts
│   ├── check-archived-products.js
│   ├── check-ports.js
│   └── check-ports.ps1
├── app.js                # Standalone app version
├── config.js             # Global configuration
├── index.html            # HTML template
├── package.json          # Project configuration
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind configuration
└── postcss.config.js     # PostCSS configuration
```

## 🔧 Cấu Hình Odoo API

Chỉnh sửa file `src/config.js`:

```javascript
export const ODOO_CONFIG = {
    useSampleData: false,  // Đổi thành false để sử dụng API thực
    apiEndpoint: 'http://your-odoo-server.com/web/dataset/call_kw',
    database: 'bonario-vietnam',
    userId: 208,
    apiKey: 'your-api-key-here',
    // ...
};
```

## 🎨 Đặc Điểm Thiết Kế

- **Tech Style**: Dark theme, gradient background, glow effects
- **Glass Effect**: Sử dụng backdrop-blur để tạo UI hiện đại kiểu glass
- **Animations**: Smooth transition animations và loading animations
- **Responsive Layout**: Tương thích hoàn hảo với mọi kích thước màn hình

## 📦 Mapping Kho

Hệ thống hỗ trợ các kho sau:

- **165** - BONAP/Stock
- **157** - ORDAP/Stock
- **20** - ORDHL/Stock
- **219** - ORDHY/Stock
- **195** - ORDST/Stock

## � Documentation

- [Quick Start Guide](docs/QUICKSTART.md) - Hướng dẫn bắt đầu nhanh
- [Port Configuration Guide](docs/PORT-GUIDE.md) - Hướng dẫn cấu hình port
- [Pillow Products Reports](docs/) - Báo cáo sản phẩm gối

## 🛠️ Technologies

- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Vanilla JavaScript** - No framework dependencies
- **Express.js** - Backend server
- **Odoo API** - Backend integration

## 📄 License

MIT
