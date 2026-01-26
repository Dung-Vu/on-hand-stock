# Hướng Dẫn Bắt Đầu Nhanh - Quick Start Guide

## 🚀 Sử Dụng Ngay

1. **Mở trang web**
   - Mở trực tiếp file `index.html` trong trình duyệt
   - Hoặc sử dụng local server (khuyến nghị)

2. **Sử dụng Local Server (Tùy chọn)**
   ```bash
   # Sử dụng Python
   python -m http.server 8000
   
   # Sử dụng Node.js
   npx http-server
   ```
   Sau đó truy cập `http://localhost:8000`

## ✨ Tính Năng Chính

### 📊 Hiển Thị Dữ Liệu
- **Nhóm theo Kho**: Tự động nhóm dữ liệu tồn kho theo 5 kho
- **Nhóm theo Danh Mục**: Trong mỗi kho, sản phẩm được nhóm theo danh mục
- **Thông Tin Thống Kê**: Hiển thị real-time tổng số kho, sản phẩm và số lượng

### 🔍 Tìm Kiếm và Lọc
- **Tìm Kiếm Sản Phẩm**: Nhập tên sản phẩm hoặc số lô trong ô tìm kiếm
- **Lọc Kho**: Sử dụng menu dropdown để lọc theo kho cụ thể
- **Lọc Danh Mục**: Sử dụng menu dropdown để lọc theo danh mục cụ thể
- **Xóa Bộ Lọc**: Click nút ✕ để xóa tất cả điều kiện lọc

### 📥 Xuất Dữ Liệu
- Click nút "Xuất Excel (CSV)" để xuất dữ liệu ra file CSV
- File xuất bao gồm tất cả các trường, tiện lợi cho phân tích trong Excel

## 🔧 Kết Nối Odoo API

Để kết nối với Odoo API thực tế:

1. Chỉnh sửa file `config.js`
2. Đặt `useSampleData: false`
3. Cấu hình thông tin Odoo server của bạn:
   ```javascript
   const ODOO_CONFIG = {
       useSampleData: false,
       apiEndpoint: 'http://your-odoo-server.com/web/dataset/call_kw',
       database: '',
       userId: ,
       apiKey: 'your-api-key-here',
       // ...
   };
   ```

## 📱 Hỗ Trợ Mobile

Ứng dụng web hoàn toàn hỗ trợ thiết bị di động, có thể sử dụng bình thường trên điện thoại và tablet.

## 🎨 Đặc Điểm Giao Diện

- Thiết kế gradient hiện đại
- Responsive layout, tương thích mọi kích thước màn hình
- Hiển thị và nhóm dữ liệu rõ ràng
- Chức năng tìm kiếm và lọc trực quan

## 💡 Mẹo Sử Dụng

1. **Tìm Kiếm Nhanh**: Nhập trực tiếp tên sản phẩm vào ô tìm kiếm, không cần click nút
2. **Lọc Kết Hợp**: Có thể sử dụng đồng thời tìm kiếm, lọc kho và lọc danh mục
3. **Xuất Dữ Liệu**: Chức năng xuất sẽ xuất tất cả dữ liệu, không bị ảnh hưởng bởi điều kiện lọc hiện tại
4. **Tự Động Tải**: Trang sẽ tự động tải dữ liệu khi mở

## ❓ Câu Hỏi Thường Gặp

**Q: Tại sao hiển thị "Chưa có dữ liệu"?**
A: Vui lòng đảm bảo đã click nút "Tải dữ liệu", hoặc kiểm tra cấu hình API có đúng không.

**Q: Làm sao để sửa điều kiện truy vấn?**
A: Chỉnh sửa mảng `domain` trong file `config.js` để thay đổi điều kiện truy vấn.

**Q: Có thể thêm nhiều kho hơn không?**
A: Có thể, thêm mapping kho mới vào object `WAREHOUSE_MAP` trong file `app.js`.

**Q: Định dạng xuất dữ liệu là gì?**
A: Xuất dưới dạng CSV, bao gồm: Kho, Danh mục, Tên sản phẩm, Số lượng trong kho, Số lượng khả dụng, Số lô.
