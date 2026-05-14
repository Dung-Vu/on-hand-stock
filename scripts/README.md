# Scripts

Chạy từ project root.

| Lệnh | Mục đích |
| --- | --- |
| `npm run check-ports` | Kiểm tra port dev thường dùng |
| `npm run check-ports:ps1` | Kiểm tra port bằng PowerShell |
| `npm run check-archived` | Tìm sản phẩm archived vẫn còn tồn |

Chạy trực tiếp:

```bash
node scripts/check-ports.js
node scripts/check-archived-products.js
```

```powershell
.\scripts\check-ports.ps1
```

Output báo cáo tạm không nên commit.
