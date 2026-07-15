// ============================================
// Export ORDST Sofa Stock to Excel
// Loc theo: ten san pham HOAC danh muc chua "sofa"
// Hien thi ro variant (theo tung lot/serial)
// ============================================
import ExcelJS from "exceljs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "..");

// ============================================
// ODOO CONFIG
// ============================================
const ODOO = {
  endpoint: "https://bonario-vietnam.odoo.com/jsonrpc",
  database: "bonario-vietnam",
  userId: 208,
  apiKey: "80aa54434e151ac3f2002b9d85bce253853f84fa",
};

const ORDST_LOCATION_IDS = [195, 285];

// ============================================
// ODOO JSON-RPC CALL
// ============================================
async function odooCall(model, method, domain, fields, options = {}) {
  const body = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO.database, ODOO.userId, ODOO.apiKey, model, method, domain, { fields, ...options }],
    },
    id: 1,
  };
  const res = await fetch(ODOO.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Odoo API error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "Odoo call failed");
  return json.result;
}

function getMany2OneId(val) {
  return Array.isArray(val) ? val[0] : val;
}
function getMany2OneName(val) {
  return Array.isArray(val) ? val[1] : "";
}

// ============================================
// FETCH ALL STOCK FOR ORDST
// ============================================
async function fetchORDSTStock() {
  console.log("Dang lay du lieu stock.quant cho ORDST...");
  const quants = await odooCall(
    "stock.quant",
    "search_read",
    [[["location_id", "in", ORDST_LOCATION_IDS], ["quantity", ">", 0]]],
    ["product_id", "location_id", "quantity", "available_quantity", "lot_id", "package_id", "product_categ_id"],
    { order: "product_id asc", limit: 100000 }
  );
  console.log(`  -> Tim thay ${quants.length} dong stock tai ORDST`);
  return quants;
}

// ============================================
// FETCH PRODUCT DETAILS
// ============================================
async function fetchProductDetails(productIds) {
  const unique = [...new Set(productIds)];
  console.log(`Dang lay thong tin ${unique.length} san pham...`);
  const products = [];
  const chunkSize = 1000;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const batch = await odooCall("product.product", "search_read", [[["id", "in", chunk]]], [
      "id", "name", "display_name", "default_code", "categ_id", "company_id",
    ]);
    products.push(...batch);
  }
  const map = new Map();
  for (const p of products) {
    map.set(p.id, {
      name: p.display_name || p.name,
      base_name: p.name,
      default_code: p.default_code || "",
      category_id: getMany2OneId(p.categ_id),
      category_name: getMany2OneName(p.categ_id),
      company_id: getMany2OneId(p.company_id),
      company_name: getMany2OneName(p.company_id),
    });
  }
  return map;
}

// ============================================
// FETCH CATEGORY DETAILS (for complete_name)
// ============================================
async function fetchCategoryDetails(categoryIds) {
  const unique = [...new Set(categoryIds)];
  console.log(`Dang lay thong tin ${unique.length} danh muc...`);
  const cats = await odooCall("product.category", "search_read", [[["id", "in", unique]]], [
    "id", "name", "complete_name", "parent_id",
  ]);
  const map = new Map();
  for (const c of cats) {
    map.set(c.id, {
      name: c.name,
      complete_name: c.complete_name,
      parent_id: getMany2OneId(c.parent_id),
    });
  }
  return map;
}

// ============================================
// FILTER: ten SP HOAC danh muc chua "sofa" (giong app)
// ============================================
function isSofa(productName, categoryName, categoryCompleteName) {
  const search = (s) => (s || "").toLowerCase();
  const needle = "sofa";
  if (search(productName).includes(needle)) return true;
  if (search(categoryName).includes(needle)) return true;
  if (search(categoryCompleteName).includes(needle)) return true;
  return false;
}

// ============================================
// STYLES
// ============================================
const S = {
  header: {
    font: { bold: true, size: 12, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF6B5A45" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: { top: { style: "thin", color: { argb: "FF5D5044" } }, bottom: { style: "thin", color: { argb: "FF5D5044" } }, left: { style: "thin", color: { argb: "FF5D5044" } }, right: { style: "thin", color: { argb: "FF5D5044" } } },
  },
  title: {
    font: { bold: true, size: 16, color: { argb: "FF2A231F" } },
    alignment: { horizontal: "center", vertical: "middle" },
  },
  subtitle: {
    font: { size: 11, color: { argb: "FF5D5044" } },
    alignment: { horizontal: "center", vertical: "middle" },
  },
  data: {
    alignment: { vertical: "middle", wrapText: true },
    border: { top: { style: "thin", color: { argb: "FFE8DDD4" } }, bottom: { style: "thin", color: { argb: "FFE8DDD4" } }, left: { style: "thin", color: { argb: "FFE8DDD4" } }, right: { style: "thin", color: { argb: "FFE8DDD4" } } },
  },
  num: { alignment: { horizontal: "right", vertical: "middle" }, numFmt: "#,##0" },
  good: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4EDDA" } }, font: { color: { argb: "FF155724" } } },
  low: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3CD" } }, font: { color: { argb: "FF856404" } } },
  out: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8D7DA" } }, font: { color: { argb: "FF721C24" } } },
  cat: { font: { bold: true, size: 11, color: { argb: "FF3F3630" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0EB" } } },
  sumHdr: { font: { bold: true, size: 11, color: { argb: "FF2A231F" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8DDD4" } }, alignment: { horizontal: "center", vertical: "middle" }, border: { top: { style: "thin", color: { argb: "FFCCBBAA" } }, bottom: { style: "thin", color: { argb: "FFCCBBAA" } }, left: { style: "thin", color: { argb: "FFCCBBAA" } }, right: { style: "thin", color: { argb: "FFCCBBAA" } } } },
};

function as(cell, style) {
  if (style.font) cell.font = style.font;
  if (style.fill) cell.fill = style.fill;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border) cell.border = style.border;
  if (style.numFmt) cell.numFmt = style.numFmt;
}

function stockStyle(qty, avail) {
  if (qty <= 0) return S.out;
  if (avail < qty * 0.2) return S.low;
  return S.good;
}

// ============================================
// BUILD EXCEL
// ============================================
async function buildExcel(rows, mergedProducts) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bonario Stock System";
  wb.created = new Date();
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Sort rows by category complete name, then product name, then quantity desc
  rows.sort((a, b) => {
    const ca = a.category_complete_name || "";
    const cb = b.category_complete_name || "";
    if (ca !== cb) return ca.localeCompare(cb);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return b.quantity - a.quantity;
  });

  // ============================================
  // SHEET 1: VARIANT DETAIL (tung lot)
  // ============================================
  const ws1 = wb.addWorksheet("Chi Tiet Variant", { views: [{ state: "frozen", ySplit: 4 }] });
  const COLS = [
    { w: 6  }, // STT
    { w: 16 }, // Ma SP
    { w: 55 }, // Ten San Pham
    { w: 28 }, // Danh Muc
    { w: 22 }, // Lot / Serial
    { w: 14 }, // So Luong
    { w: 14 }, // Kha Dung
    { w: 12 }, // Cong Ty
  ];
  const HEADERS = ["STT", "Ma SP", "Ten San Pham", "Danh Muc", "Lot / Serial", "So Luong", "Kha Dung", "Cong Ty"];

  ws1.mergeCells("A1:H1"); ws1.getCell("A1").value = `CHI TIET VARIANT SOFA ONHAND - KHO ORDST`; as(ws1.getCell("A1"), S.title);
  ws1.mergeCells("A2:H2"); ws1.getCell("A2").value = `Ngay xuat: ${dateStr} | Tong: ${rows.length} variant | ${mergedProducts.length} san pham gop`; as(ws1.getCell("A2"), S.subtitle);
  ws1.mergeCells("A3:H3"); ws1.getCell("A3").value = "";

  const hdr = ws1.getRow(4); HEADERS.forEach((h, i) => { const c = hdr.getCell(i + 1); c.value = h; as(c, S.header); }); hdr.height = 24;

  let r = 5;
  let lastCat = "";
  for (const item of rows) {
    if (item.category_complete_name !== lastCat) {
      lastCat = item.category_complete_name;
      ws1.mergeCells(`A${r}:H${r}`);
      const catCell = ws1.getCell(`A${r}`);
      catCell.value = lastCat || item.category_name || "Khac";
      for (let c = 1; c <= 8; c++) as(ws1.getRow(r).getCell(c), S.cat);
      r++;
    }

    const row = ws1.getRow(r);
    row.getCell(1).value = r - 4;  // running number
    row.getCell(2).value = item.sku;
    row.getCell(3).value = item.name;
    row.getCell(4).value = item.category_name;
    row.getCell(5).value = item.lot_name || "(khong lot)";
    row.getCell(6).value = item.quantity;
    row.getCell(7).value = item.available_quantity;
    row.getCell(8).value = item.company_name;

    for (let c = 1; c <= 8; c++) as(row.getCell(c), S.data);
    as(row.getCell(6), { ...S.data, ...S.num, ...stockStyle(item.quantity, item.available_quantity) });
    as(row.getCell(7), { ...S.data, ...S.num, ...stockStyle(item.quantity, item.available_quantity) });
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r++;
  }

  ws1.autoFilter = { from: "A4", to: `H${r - 1}` };
  COLS.forEach((c, i) => { ws1.getColumn(i + 1).width = c.w; });

  // ============================================
  // SHEET 2: MERGED BY PRODUCT (giong app)
  // ============================================
  const ws2 = wb.addWorksheet("Gop Theo SP", { views: [{ state: "frozen", ySplit: 4 }] });
  const COLS2 = [
    { w: 6  }, // STT
    { w: 16 }, // Ma SP
    { w: 55 }, // Ten San Pham
    { w: 28 }, // Danh Muc
    { w: 14 }, // Tong SL
    { w: 14 }, // Tong Kha Dung
    { w: 30 }, // Cac Lot
    { w: 12 }, // Cong Ty
  ];
  const HEADERS2 = ["STT", "Ma SP", "Ten San Pham", "Danh Muc", "Tong So Luong", "Tong Kha Dung", "Cac Lot / Serial", "Cong Ty"];

  // Group merged products by category
  const byCat = new Map();
  for (const p of mergedProducts) {
    const cat = p.category_complete_name || p.category_name || "Khac";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(p);
  }
  const sortedCats = [...byCat.keys()].sort();

  ws2.mergeCells("A1:H1"); ws2.getCell("A1").value = `SOFA ONHAND GOP THEO SAN PHAM - KHO ORDST`; as(ws2.getCell("A1"), S.title);
  ws2.mergeCells("A2:H2"); ws2.getCell("A2").value = `Ngay xuat: ${dateStr} | Tong: ${mergedProducts.length} san pham (da gop lot)`; as(ws2.getCell("A2"), S.subtitle);
  ws2.mergeCells("A3:H3"); ws2.getCell("A3").value = "";

  const hdr2 = ws2.getRow(4); HEADERS2.forEach((h, i) => { const c = hdr2.getCell(i + 1); c.value = h; as(c, S.header); }); hdr2.height = 24;

  let r2 = 5;
  let stt = 0;
  let grandTotalQty = 0;
  let grandTotalAvail = 0;

  for (const catName of sortedCats) {
    const items = byCat.get(catName);
    items.sort((a, b) => b.total_quantity - a.total_quantity);

    ws2.mergeCells(`A${r2}:H${r2}`);
    const catCell = ws2.getCell(`A${r2}`);
    catCell.value = `${catName} (${items.length} san pham)`;
    for (let c = 1; c <= 8; c++) as(ws2.getRow(r2).getCell(c), S.cat);
    r2++;

    for (const p of items) {
      stt++;
      grandTotalQty += p.total_quantity;
      grandTotalAvail += p.total_available;

      const row = ws2.getRow(r2);
      row.getCell(1).value = stt;
      row.getCell(2).value = p.sku;
      row.getCell(3).value = p.name;
      row.getCell(4).value = p.category_name;
      row.getCell(5).value = p.total_quantity;
      row.getCell(6).value = p.total_available;
      row.getCell(7).value = p.lot_ids.join(", ") || "(khong lot)";
      row.getCell(8).value = p.company_name;

      for (let c = 1; c <= 8; c++) as(row.getCell(c), S.data);
      as(row.getCell(5), { ...S.data, ...S.num, ...stockStyle(p.total_quantity, p.total_available) });
      as(row.getCell(6), { ...S.data, ...S.num, ...stockStyle(p.total_quantity, p.total_available) });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      r2++;
    }
  }

  // Grand total row
  const tr = ws2.getRow(r2);
  tr.getCell(1).value = "";
  tr.getCell(2).value = "";
  tr.getCell(3).value = "TONG CONG";
  tr.getCell(4).value = `${mergedProducts.length} SP`;
  tr.getCell(5).value = grandTotalQty;
  tr.getCell(6).value = grandTotalAvail;
  tr.getCell(7).value = "";
  tr.getCell(8).value = "";
  for (let c = 1; c <= 8; c++) {
    as(tr.getCell(c), { ...S.data, font: { bold: true, size: 11 }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0EB" } } });
  }
  as(tr.getCell(5), { ...S.data, ...S.num, font: { bold: true } });
  as(tr.getCell(6), { ...S.data, ...S.num, font: { bold: true } });

  ws2.autoFilter = { from: "A4", to: `H${r2 - 1}` };
  COLS2.forEach((c, i) => { ws2.getColumn(i + 1).width = c.w; });

  // ============================================
  // SHEET 3: TONG HOP THEO DANH MUC
  // ============================================
  const ws3 = wb.addWorksheet("Tong Hop Danh Muc");
  ws3.mergeCells("A1:D1"); ws3.getCell("A1").value = `TONG HOP SOFA ONHAND THEO DANH MUC - KHO ORDST`; as(ws3.getCell("A1"), S.title);
  ws3.mergeCells("A2:D2"); ws3.getCell("A2").value = `Ngay xuat: ${dateStr}`; as(ws3.getCell("A2"), S.subtitle);

  const sh = ws3.getRow(4);
  ["Danh Muc", "So SP", "Tong So Luong", "Tong Kha Dung"].forEach((h, i) => { const c = sh.getCell(i + 1); c.value = h; as(c, S.sumHdr); });

  let sr = 5;
  for (const catName of sortedCats) {
    const items = byCat.get(catName);
    const tq = items.reduce((s, x) => s + x.total_quantity, 0);
    const ta = items.reduce((s, x) => s + x.total_available, 0);
    const row = ws3.getRow(sr);
    row.getCell(1).value = catName;
    row.getCell(2).value = items.length;
    row.getCell(3).value = tq;
    row.getCell(4).value = ta;
    for (let c = 1; c <= 4; c++) as(row.getCell(c), S.data);
    as(row.getCell(3), { ...S.data, ...S.num });
    as(row.getCell(4), { ...S.data, ...S.num });
    sr++;
  }

  const ttr = ws3.getRow(sr);
  ttr.getCell(1).value = "TONG CONG";
  ttr.getCell(2).value = mergedProducts.length;
  ttr.getCell(3).value = grandTotalQty;
  ttr.getCell(4).value = grandTotalAvail;
  for (let c = 1; c <= 4; c++) as(ttr.getCell(c), { ...S.data, font: { bold: true, size: 11 }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0EB" } } });
  as(ttr.getCell(3), { ...S.data, ...S.num, font: { bold: true } });
  as(ttr.getCell(4), { ...S.data, ...S.num, font: { bold: true } });
  [40, 12, 16, 16].forEach((w, i) => { ws3.getColumn(i + 1).width = w; });

  // Save
  const fileName = `ORDST_Sofa_Onhand_${now.toISOString().slice(0, 10)}.xlsx`;
  const filePath = resolve(OUTPUT_DIR, fileName);
  await wb.xlsx.writeFile(filePath);
  console.log(`\nDa xuat file: ${filePath}`);
}

// ============================================
// MERGE ROWS BY PRODUCT_ID
// ============================================
function mergeByProduct(rows) {
  const map = new Map();
  for (const item of rows) {
    const key = item.product_id;
    if (!map.has(key)) {
      map.set(key, {
        product_id: key,
        name: item.name,
        sku: item.sku,
        category_id: item.category_id,
        category_name: item.category_name,
        category_complete_name: item.category_complete_name,
        company_name: item.company_name,
        total_quantity: 0,
        total_available: 0,
        lot_ids: [],
      });
    }
    const p = map.get(key);
    p.total_quantity += item.quantity;
    p.total_available += item.available_quantity;
    if (item.lot_name && !p.lot_ids.includes(item.lot_name)) {
      p.lot_ids.push(item.lot_name);
    }
  }
  return [...map.values()];
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log("===== EXPORT ORDST SOFA STOCK =====\n");

  const quants = await fetchORDSTStock();
  if (quants.length === 0) { console.log("Khong co stock nao tai ORDST."); return; }

  const productIds = quants.map((q) => getMany2OneId(q.product_id)).filter(Boolean);
  const productMap = await fetchProductDetails(productIds);

  const categoryIds = quants.map((q) => getMany2OneId(q.product_categ_id)).filter(Boolean);
  const categoryMap = await fetchCategoryDetails(categoryIds);

  // Enrich quants
  let allRows = [];
  for (const q of quants) {
    const pid = getMany2OneId(q.product_id);
    const prod = productMap.get(pid);
    const cid = getMany2OneId(q.product_categ_id);
    const cat = categoryMap.get(cid);
    if (!prod) continue;
    allRows.push({
      product_id: pid,
      name: prod.name,
      sku: prod.default_code,
      category_id: cid,
      category_name: cat?.name || getMany2OneName(q.product_categ_id),
      category_complete_name: cat?.complete_name || "",
      quantity: q.quantity,
      available_quantity: q.available_quantity,
      lot_name: getMany2OneName(q.lot_id),
      company_name: prod.company_name,
    });
  }

  console.log(`Tong so dong stock tai ORDST: ${allRows.length}`);

  // Filter sofa: ten SP HOAC danh muc (giong app search)
  const sofaRows = allRows.filter((row) =>
    isSofa(row.name, row.category_name, row.category_complete_name)
  );

  console.log(`Sau khi loc "sofa": ${sofaRows.length} variant dong`);

  if (sofaRows.length === 0) { console.log("Khong co sofa nao onhand tai ORDST."); return; }

  // Merge by product_id for the merged sheet
  const merged = mergeByProduct(sofaRows);
  console.log(`San pham gop (da merge lot): ${merged.length}`);

  await buildExcel(sofaRows, merged);

  console.log(`\n===== KET QUA =====`);
  console.log(`  Variant dong (tung lot): ${sofaRows.length}`);
  console.log(`  San pham gop (merge lot): ${merged.length}`);
  console.log(`  Tong so luong: ${merged.reduce((s, p) => s + p.total_quantity, 0)}`);
  console.log(`  Tong kha dung: ${merged.reduce((s, p) => s + p.total_available, 0)}`);
  console.log(`  So danh muc: ${[...new Set(sofaRows.map((r) => r.category_complete_name))].length}`);
  console.log("=====================");
}

main().catch((err) => {
  console.error("Loi:", err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
