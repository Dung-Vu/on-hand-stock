# 🔧 Scripts / Công Cụ Hỗ Trợ

Thư mục này chứa các script tiện ích để kiểm tra và quản lý hệ thống.

## 📜 Available Scripts

### JavaScript Scripts

- **check-archived-products.js**
  - Kiểm tra các sản phẩm đã archive nhưng vẫn còn tồn kho
  - Tạo báo cáo chi tiết về các sản phẩm cần xem xét
  - Run: `node scripts/check-archived-products.js`

- **check-ports.js**
  - Kiểm tra các port đang sử dụng (4000-4010, 5173-5177)
  - Hiển thị process đang chiếm port
  - Run: `node scripts/check-ports.js`

### PowerShell Scripts

- **check-ports.ps1**
  - Version PowerShell của check-ports.js
  - Kiểm tra và hiển thị thông tin ports trên Windows
  - Run: `.\scripts\check-ports.ps1`

## 🚀 Usage

```bash
# From project root
node scripts/check-archived-products.js
node scripts/check-ports.js

# PowerShell
.\scripts\check-ports.ps1
```

## 📝 Notes

- Đảm bảo đã cài đặt dependencies: `npm install`
- Cấu hình environment variables trong `server/.env` trước khi chạy
- Scripts sẽ tạo output files trong thư mục gốc của project
