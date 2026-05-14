# Scripts

Các script hỗ trợ kiểm tra và vận hành repo. Chạy từ project root.

## Lệnh npm

```bash
npm run check-ports
npm run check-archived
```

```powershell
npm run check-ports:ps1
```

## Script trực tiếp

```bash
node scripts/check-ports.js
node scripts/check-archived-products.js
```

```powershell
.\scripts\check-ports.ps1
```

## Ghi chú

- `check-ports` kiểm tra các port phát triển thường dùng.
- `check-archived` cần cấu hình Odoo/API trong environment.
- Báo cáo sinh ra từ script không nên commit nếu chỉ là output tạm.
