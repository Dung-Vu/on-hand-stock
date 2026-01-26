# 📁 Cấu Trúc Thư Mục / Folder Structure

## 🏗️ Tổng Quan Cấu Trúc

```
onhand-stock-v1/
├── 📂 src/                    # Source code chính
│   ├── 📂 components/         # UI Components
│   ├── 📂 store/              # State management
│   └── 📂 utils/              # Utility functions
├── 📂 server/                 # Backend API server
├── 📂 docs/                   # Documentation & Reports
├── 📂 scripts/                # Utility scripts
├── 📂 dist/                   # Build output (generated)
├── 📂 node_modules/           # Dependencies (generated)
└── 📄 Configuration files     # Root config files
```

## 📋 Chi Tiết Các Thư Mục

### 1. 📂 src/ - Source Code

**Mục đích**: Chứa toàn bộ source code của frontend application

```
src/
├── components/
│   ├── Header.js       # Header component với branding
│   ├── Controls.js     # Control panel (load, export, filters)
│   ├── StockData.js    # Stock data display component
│   └── Tabs.js         # Tab navigation component
├── store/
│   └── dataStore.js    # Data management & business logic
├── utils/
│   └── dom.js          # DOM manipulation utilities
├── config.js           # API configuration
├── App.js              # Main application component
├── main.js             # Application entry point
└── style.css           # Global styles
```

**Quy tắc**:
- Tất cả components export default function
- Sử dụng native JavaScript (không framework)
- Imports sử dụng relative paths với extension `.js`

### 2. 📂 server/ - Backend Server

**Mục đích**: Express.js server proxy đến Odoo API

```
server/
├── index.js          # Express server với CORS & API endpoints
├── package.json      # Server dependencies
└── .env             # Environment variables (not in git)
```

**Chức năng**:
- Proxy requests đến Odoo API
- Bảo mật API keys và credentials
- CORS configuration cho multiple origins
- Auto-detect port availability

### 3. 📂 docs/ - Documentation

**Mục đích**: Tài liệu hướng dẫn và báo cáo

```
docs/
├── README.md                              # Index của docs
├── QUICKSTART.md                          # Hướng dẫn bắt đầu nhanh
├── PORT-GUIDE.md                          # Hướng dẫn ports
├── PILLOW-PRODUCTS-LIST.md                # Danh sách sản phẩm
└── PILLOW-PRODUCTS-ORD-WAREHOUSES.md     # Báo cáo chi tiết
```

**Quy tắc**:
- Tất cả docs viết bằng Markdown
- Tiếng Việt cho nội dung chính
- Bổ sung tiếng Anh cho technical terms

### 4. 📂 scripts/ - Utility Scripts

**Mục đích**: Scripts kiểm tra và quản lý hệ thống

```
scripts/
├── README.md                      # Hướng dẫn sử dụng scripts
├── check-archived-products.js     # Kiểm tra sản phẩm archived
├── check-ports.js                 # Kiểm tra ports (Node.js)
└── check-ports.ps1                # Kiểm tra ports (PowerShell)
```

**Usage**: Chạy từ project root với `node scripts/<script-name>.js`

## 📄 Root Files

### Configuration Files

| File | Mục đích |
|------|----------|
| `package.json` | NPM dependencies & scripts |
| `vite.config.js` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS plugins |
| `.prettierrc` | Code formatting rules |
| `.editorconfig` | Editor settings |
| `.gitignore` | Git ignore patterns |

### Application Files

| File | Mục đích |
|------|----------|
| `index.html` | HTML entry point |
| `app.js` | Standalone version (không dùng build tool) |
| `config.js` | Global configuration |
| `styles.css` | Additional styles |
| `favicon.svg` | Website icon |

## 🎯 Best Practices

### File Naming
- **Components**: PascalCase (e.g., `Header.js`, `StockData.js`)
- **Utilities**: camelCase (e.g., `dataStore.js`, `dom.js`)
- **Configs**: kebab-case (e.g., `vite.config.js`)
- **Docs**: UPPERCASE (e.g., `README.md`, `QUICKSTART.md`)

### Organization Rules
1. **Components** - Một component = một file
2. **Documentation** - Luôn trong thư mục `docs/`
3. **Scripts** - Luôn trong thư mục `scripts/`
4. **Generated files** - Không commit (dist/, node_modules/)

### Import/Export
```javascript
// ✅ Good - Explicit imports
import { createElement } from '../utils/dom.js'
import Header from './components/Header.js'

// ❌ Avoid - Implicit imports
import { createElement } from '../utils/dom'
```

## 🔄 Workflow

### Development
1. Edit files trong `src/`
2. Vite auto-reload browser
3. Check console cho errors

### Building
1. `npm run build` tạo production files
2. Output vào `dist/` folder
3. Deploy files từ `dist/`

### Adding Features
1. Tạo component mới trong `src/components/`
2. Import vào `src/App.js`
3. Update documentation trong `docs/`

## 📊 File Count Summary

- **Total Directories**: 7 main folders
- **Source Files**: ~15 JS files
- **Documentation**: 5 MD files
- **Configuration**: 8 config files
- **Scripts**: 3 utility scripts

---

*Last Updated: January 26, 2026*
