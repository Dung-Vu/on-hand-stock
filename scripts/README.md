# Scripts

Chay tu project root.

| Lenh                                | Muc dich                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm run check-ports`              | Kiem tra port dev thuong dung                                                          |
| `pnpm run check-ports:ps1`          | Kiem tra port bang PowerShell                                                          |
| `pnpm run check-archived`           | Tim san pham archived van con ton                                                      |
| `node scripts/export-ordst-sofa.js` | Xuat sofa ORDST ra Excel. Doc Odoo tu `server/.env`. File `ORDST_*.xlsx` khong commit. |

Chay truc tiep:

```bash
node scripts/check-ports.js
node scripts/check-archived-products.js
```

```powershell
.\scripts\check-ports.ps1
```

Output bao cao tam khong nen commit.
