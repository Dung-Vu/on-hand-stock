import { createElement } from "../utils/dom.js";
import { exportStocktakeToExcel } from "../utils/export.js";
import { defaultMonth } from "../store/stocktakeStore.js";
import {
    loadStocktakeDb as loadStocktake,
    setLineDb as setLine,
    lockStocktakeDb as lockStocktake,
    unlockStocktakeDb as unlockStocktake,
    listStocktakesDb as listStocktakes,
} from "../store/stocktakeDbStore.js";

function formatNumber(n) {
    const num = Number(n);
    return Number.isFinite(num) ? num.toLocaleString() : "0";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toCsv(rows) {
    const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function download(filename, content, mime = "text/csv;charset=utf-8;") {
    const blob = new Blob(["\ufeff" + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function Stocktake({
    getWarehouses,
    getProductsForWarehouse,
    onToast,
    currentUser,
}) {
    const container = createElement("div", {
        id: "stocktakeView",
        class: "max-w-7xl mx-auto px-4 py-6 hidden",
    });

    // Header row
    const headerRow = createElement("div", {
        class: "flex items-start justify-between gap-3 flex-wrap",
    });
    const title = createElement("div", {});
    title.innerHTML = `
        <div class="text-lg font-bold" style="color:#2a231f">🧾 Kiểm kho hàng tháng</div>
        <div class="text-xs" style="color:#7d6d5a">Tạo phiếu theo tháng & kho, nhập số lượng thực tế và xuất báo cáo chênh lệch.</div>
    `;

    const actions = createElement("div", { class: "flex items-center gap-2" });

    const exportExcelBtn = createElement("button", {
        class: "px-3 py-2 rounded-lg text-xs font-semibold",
    });
    exportExcelBtn.style.background =
        "linear-gradient(135deg, #10b981 0%, #059669 100%)";
    exportExcelBtn.style.color = "white";
    exportExcelBtn.textContent = "📊 Xuất Excel";

    const exportBtn = createElement("button", {
        class: "px-3 py-2 rounded-lg text-xs font-semibold",
    });
    exportBtn.style.background = "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)";
    exportBtn.style.color = "white";
    exportBtn.textContent = "⬇️ Xuất CSV";

    const lockBtn = createElement("button", {
        class: "px-3 py-2 rounded-lg text-xs font-semibold",
    });
    lockBtn.style.background = "linear-gradient(135deg, #6b5a45 0%, #8b7355 100%)";
    lockBtn.style.color = "white";
    lockBtn.textContent = "🔒 Chốt phiếu";

    actions.appendChild(exportExcelBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(lockBtn);
    headerRow.appendChild(title);
    headerRow.appendChild(actions);

    // Filters
    const filterRow = createElement("div", {
        class: "mt-4 grid grid-cols-1 md:grid-cols-4 gap-3",
    });

    const monthInput = createElement("input", {
        type: "month",
        class: "px-3 py-2 rounded-lg",
        value: defaultMonth(),
    });
    monthInput.style.border = "1.5px solid #d4c4b0";
    monthInput.style.backgroundColor = "white";

    const warehouseSelect = createElement("select", {
        class: "px-3 py-2 rounded-lg",
    });
    warehouseSelect.style.border = "1.5px solid #d4c4b0";
    warehouseSelect.style.backgroundColor = "white";

    const searchInput = createElement("input", {
        type: "text",
        placeholder: "🔍 Tìm sản phẩm…",
        class: "px-3 py-2 rounded-lg",
    });
    searchInput.style.border = "1.5px solid #d4c4b0";
    searchInput.style.backgroundColor = "white";

    const historySelect = createElement("select", {
        class: "px-3 py-2 rounded-lg",
        title: "Mở phiếu đã lưu",
    });
    historySelect.style.border = "1.5px solid #d4c4b0";
    historySelect.style.backgroundColor = "white";

    filterRow.appendChild(monthInput);
    filterRow.appendChild(warehouseSelect);
    filterRow.appendChild(searchInput);
    filterRow.appendChild(historySelect);

    // Table
    const tableWrap = createElement("div", {
        class: "mt-4 bg-white rounded-xl",
    });
    tableWrap.style.border = "1.5px solid #e8ddd4";
    tableWrap.style.overflow = "hidden";

    const tableHeader = createElement("div", {
        class: "grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold hidden md:grid",
    });
    tableHeader.style.backgroundColor = "#faf8f5";
    tableHeader.style.borderBottom = "1px solid #e8ddd4";
    tableHeader.innerHTML = `
        <div class="col-span-5">Sản phẩm</div>
        <div class="col-span-2 text-right">Tồn hệ thống</div>
        <div class="col-span-2 text-right">Thực tế</div>
        <div class="col-span-2 text-right">Chênh lệch</div>
        <div class="col-span-1">Ghi chú</div>
    `;

    // Mobile header (simplified)
    const mobileTableHeader = createElement("div", {
        class: "grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold md:hidden",
    });
    mobileTableHeader.style.backgroundColor = "#faf8f5";
    mobileTableHeader.style.borderBottom = "1px solid #e8ddd4";
    mobileTableHeader.innerHTML = `
        <div class="col-span-6">Sản phẩm</div>
        <div class="col-span-2 text-right">Tồn</div>
        <div class="col-span-2 text-right">Thực</div>
        <div class="col-span-2 text-right">Lệch</div>
    `;

    const tableBody = createElement("div", { id: "stocktakeTableBody" });

    tableWrap.appendChild(tableHeader);
    tableWrap.appendChild(mobileTableHeader);
    tableWrap.appendChild(tableBody);

    container.appendChild(headerRow);
    container.appendChild(filterRow);
    container.appendChild(tableWrap);

    // State
    let doc = null;
    let products = [];
    let historyItemsById = new Map();

    function isMobile() {
        if (typeof window === "undefined") return false;
        return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    }

    function refreshWarehouses() {
        const warehouses = getWarehouses();
        warehouseSelect.innerHTML = "";
        warehouses.forEach((w) => {
            const opt = document.createElement("option");
            opt.value = w;
            opt.textContent = w;
            warehouseSelect.appendChild(opt);
        });

        const savedWarehouse = localStorage.getItem("lastActiveWarehouse");
        const initial = savedWarehouse && warehouses.includes(savedWarehouse) ? savedWarehouse : warehouses[0];
        warehouseSelect.value = initial || "";
    }

    function createEmptyDoc(month, warehouse) {
        return {
            id: null,
            month,
            warehouse,
            status: "draft",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lines: {},
            stats: null,
        };
    }

    function updateLockButton() {
        lockBtn.textContent = doc?.status === "locked" ? "🔓 Mở khóa" : "🔒 Chốt phiếu";
    }

    function showTableMessage(message) {
        tableBody.innerHTML = "";
        const empty = createElement("div", { class: "p-6 text-sm" });
        empty.style.color = "#7d6d5a";
        empty.textContent = message;
        tableBody.appendChild(empty);
    }

    function updateVarianceDisplay(target, variance) {
        if (variance === null || variance === undefined) {
            target.style.color = "#7d6d5a";
            target.textContent = "-";
        } else if (variance === 0) {
            target.style.color = "#1b5e20";
            target.textContent = "0";
        } else if (variance > 0) {
            target.style.color = "#155724";
            target.textContent = `+${formatNumber(variance)}`;
        } else {
            target.style.color = "#721c24";
            target.textContent = formatNumber(variance);
        }
    }

    async function refreshHistory() {
        const items = await listStocktakes();
        historyItemsById = new Map(items.map((it) => [String(it.id), it]));
        historySelect.innerHTML = "";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "🕘 Lịch sử phiếu…";
        historySelect.appendChild(opt0);

        items.slice(0, 50).forEach((it) => {
            const opt = document.createElement("option");
            opt.value = String(it.id);
            opt.textContent = `${it.month} • ${it.warehouse} • ${it.status}`;
            historySelect.appendChild(opt);
        });
    }

    async function loadDoc() {
        const month = monthInput.value || defaultMonth();
        const wh = warehouseSelect.value;

        if (!wh) {
            doc = createEmptyDoc(month, wh);
            updateLockButton();
            return;
        }

        doc = await loadStocktake({ month, warehouse: wh });
        updateLockButton();
    }

    function computeRows() {
        const q = (searchInput.value || "").toLowerCase().trim();
        const lines = doc?.lines || {};
        return products
            .filter((p) => !q || (p.name || "").toLowerCase().includes(q))
            .map((p) => {
                const line = lines[String(p.productId)] || {};
                const counted = line.counted ?? null;
                const variance =
                    counted === null || counted === undefined
                        ? null
                        : Number(counted) - Number(p.systemQty || 0);
                return {
                    ...p,
                    counted,
                    variance,
                    note: line.note || "",
                };
            });
    }

    function render() {
        if (!doc) return;
        products = getProductsForWarehouse(warehouseSelect.value);
        const rows = computeRows();
        tableBody.innerHTML = "";

        if (!products || products.length === 0) {
            const empty = createElement("div", { class: "p-6 text-sm" });
            empty.style.color = "#7d6d5a";
            empty.textContent = "Chưa có dữ liệu kho. Hãy bấm “Tải dữ liệu” trước.";
            tableBody.appendChild(empty);
            return;
        }

        const mobile = isMobile();

        rows.forEach((r) => {
            const safeName = escapeHtml(r.name);
            const safeProductId = escapeHtml(r.productId);

            if (mobile) {
                // Mobile card layout
                const card = createElement("div", {
                    class: "px-3 py-3",
                });
                card.style.borderBottom = "1px solid #f5f1ea";

                const top = createElement("div", { class: "flex items-start justify-between gap-2" });
                const name = createElement("div", { class: "flex-1 min-w-0" });
                name.innerHTML = `<div class="font-semibold text-sm" style="color:#2a231f">${safeName}</div>
                    <div class="text-[11px]" style="color:#7d6d5a">ID: ${safeProductId}</div>`;

                const noteBtn = createElement("button", {
                    class: "text-xs px-2 py-1 rounded-lg shrink-0",
                    title: "Ghi chú",
                });
                noteBtn.disabled = doc.status === "locked";
                noteBtn.style.border = "1px solid #d4c4b0";
                noteBtn.textContent = "📝";

                top.appendChild(name);
                top.appendChild(noteBtn);

                const grid = createElement("div", {
                    class: "mt-3 grid grid-cols-3 gap-2",
                });

                const sysBox = createElement("div", { class: "p-2 rounded-lg text-center" });
                sysBox.style.backgroundColor = "#faf8f5";
                sysBox.innerHTML = `<div class="text-[10px] uppercase tracking-wider" style="color:#7d6d5a">Tồn</div>
                    <div class="font-bold" style="color:#2a231f; font-variant-numeric: tabular-nums;">${formatNumber(r.systemQty)}</div>`;

                const countedBox = createElement("div", { class: "p-2 rounded-lg text-center" });
                countedBox.style.backgroundColor = "#f5f9f5";
                const countedInput = createElement("input", {
                    type: "number",
                    step: "0.01",
                    inputmode: "decimal",
                    class: "stocktake-input w-full",
                    value: r.counted ?? "",
                });
                countedInput.disabled = doc.status === "locked";
                countedBox.innerHTML = `<div class="text-[10px] uppercase tracking-wider mb-1" style="color:#7d6d5a">Thực tế</div>`;
                countedBox.appendChild(countedInput);

                const varBox = createElement("div", { class: "p-2 rounded-lg text-center" });
                varBox.style.backgroundColor = "#e8f4f8";
                const varValue = createElement("div", { class: "font-bold" });
                updateVarianceDisplay(varValue, r.variance);
                varBox.innerHTML = `<div class="text-[10px] uppercase tracking-wider" style="color:#7d6d5a">Lệch</div>`;
                varBox.appendChild(varValue);

                countedInput.addEventListener("input", (e) => {
                    const c = e.target.value === "" ? null : Number(e.target.value);
                    const vv = c === null ? null : c - Number(r.systemQty || 0);
                    updateVarianceDisplay(varValue, vv);
                });

                countedInput.addEventListener("change", async (e) => {
                    const hadSessionId = !!doc?.id;
                    try {
                        doc = await setLine({
                            doc,
                            productId: r.productId,
                            productName: r.name,
                            systemQty: r.systemQty,
                            counted: e.target.value,
                            note: doc?.lines?.[String(r.productId)]?.note ?? r.note,
                        });
                        if (!hadSessionId && doc?.id) {
                            await refreshHistory();
                        }
                    } catch (error) {
                        console.error(error);
                        onToast?.(`Lỗi lưu số lượng: ${error?.message || error}`, "error", 3000);
                        countedInput.value = doc?.lines?.[String(r.productId)]?.counted ?? "";
                        updateVarianceDisplay(varValue, r.variance);
                    }
                });

                noteBtn.addEventListener("click", async () => {
                    const next = prompt("Ghi chú:", r.note || "");
                    if (next === null) return;
                    const hadSessionId = !!doc?.id;
                    try {
                        doc = await setLine({
                            doc,
                            productId: r.productId,
                            productName: r.name,
                            systemQty: r.systemQty,
                            counted: doc?.lines?.[String(r.productId)]?.counted ?? r.counted,
                            note: next,
                        });
                        if (!hadSessionId && doc?.id) {
                            await refreshHistory();
                        }
                        onToast?.("Đã lưu ghi chú", "success", 1500);
                    } catch (error) {
                        console.error(error);
                        onToast?.(`Lỗi lưu ghi chú: ${error?.message || error}`, "error", 3000);
                    }
                });

                grid.appendChild(sysBox);
                grid.appendChild(countedBox);
                grid.appendChild(varBox);

                card.appendChild(top);
                card.appendChild(grid);
                tableBody.appendChild(card);
                return;
            }

            // Desktop row layout
            const row = createElement("div", {
                class: "grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm stocktake-row",
            });
            row.style.borderBottom = "1px solid #f5f1ea";

            const name = createElement("div", { class: "col-span-5" });
            name.innerHTML = `<div class="font-semibold" style="color:#2a231f">${safeName}</div>
                <div class="text-[11px]" style="color:#7d6d5a">ID: ${safeProductId}</div>`;

            const sys = createElement("div", { class: "col-span-2 text-right font-semibold" });
            sys.style.color = "#2a231f";
            sys.textContent = formatNumber(r.systemQty);

            const countedWrap = createElement("div", { class: "col-span-2 text-right" });
            const countedInput = createElement("input", {
                type: "number",
                step: "0.01",
                inputmode: "decimal",
                class: "stocktake-input",
                value: r.counted ?? "",
            });
            countedInput.disabled = doc.status === "locked";
            countedWrap.appendChild(countedInput);

            const varEl = createElement("div", { class: "col-span-2 text-right font-semibold" });
            updateVarianceDisplay(varEl, r.variance);

            const noteWrap = createElement("div", { class: "col-span-1" });
            const noteBtn = createElement("button", {
                class: "text-xs px-2 py-1 rounded-lg",
            });
            noteBtn.disabled = doc.status === "locked";
            noteBtn.style.border = "1px solid #d4c4b0";
            noteBtn.textContent = "📝";
            noteWrap.appendChild(noteBtn);

            countedInput.addEventListener("input", (e) => {
                const c = e.target.value === "" ? null : Number(e.target.value);
                const vv = c === null ? null : c - Number(r.systemQty || 0);
                updateVarianceDisplay(varEl, vv);
            });

            countedInput.addEventListener("change", async (e) => {
                const hadSessionId = !!doc?.id;
                try {
                    doc = await setLine({
                        doc,
                        productId: r.productId,
                        productName: r.name,
                        systemQty: r.systemQty,
                        counted: e.target.value,
                        note: doc?.lines?.[String(r.productId)]?.note ?? r.note,
                    });
                    if (!hadSessionId && doc?.id) {
                        await refreshHistory();
                    }
                } catch (error) {
                    console.error(error);
                    onToast?.(`Lỗi lưu số lượng: ${error?.message || error}`, "error", 3000);
                    countedInput.value = doc?.lines?.[String(r.productId)]?.counted ?? "";
                    updateVarianceDisplay(varEl, r.variance);
                }
            });

            noteBtn.addEventListener("click", async () => {
                const next = prompt("Ghi chú:", r.note || "");
                if (next === null) return;
                const hadSessionId = !!doc?.id;
                try {
                    doc = await setLine({
                        doc,
                        productId: r.productId,
                        productName: r.name,
                        systemQty: r.systemQty,
                        counted: doc?.lines?.[String(r.productId)]?.counted ?? r.counted,
                        note: next,
                    });
                    if (!hadSessionId && doc?.id) {
                        await refreshHistory();
                    }
                    onToast?.("Đã lưu ghi chú", "success", 1500);
                } catch (error) {
                    console.error(error);
                    onToast?.(`Lỗi lưu ghi chú: ${error?.message || error}`, "error", 3000);
                }
            });

            row.appendChild(name);
            row.appendChild(sys);
            row.appendChild(countedWrap);
            row.appendChild(varEl);
            row.appendChild(noteWrap);
            tableBody.appendChild(row);
        });
    }

    async function reloadAll() {
        showTableMessage("Đang tải phiếu kiểm kho...");
        try {
            await refreshHistory();
            await loadDoc();
            render();
        } catch (error) {
            console.error(error);
            showTableMessage("Không thể tải phiếu kiểm kho.");
            onToast?.(`Lỗi tải phiếu: ${error?.message || error}`, "error", 3000);
        }
    }

    // Events
    monthInput.addEventListener("change", () => {
        reloadAll();
    });
    warehouseSelect.addEventListener("change", () => {
        reloadAll();
    });
    searchInput.addEventListener("input", render);

    // Re-render on viewport change (mobile/desktop)
    if (typeof window !== "undefined" && window.matchMedia) {
        const mq = window.matchMedia("(max-width: 768px)");
        const handler = () => render();
        if (mq.addEventListener) mq.addEventListener("change", handler);
        else mq.addListener(handler);
    }

    historySelect.addEventListener("change", async () => {
        const key = historySelect.value;
        if (!key) return;
        try {
            const parsed = historyItemsById.get(key);
            if (!parsed) return;
            monthInput.value = parsed.month || monthInput.value;
            warehouseSelect.value = parsed.warehouse || warehouseSelect.value;
            await reloadAll();
        } finally {
            historySelect.value = "";
        }
    });

    lockBtn.addEventListener("click", async () => {
        if (!doc) return;
        try {
            if (doc.status === "locked") {
                doc = await unlockStocktake(doc);
                onToast?.("Đã mở khóa phiếu", "info", 2000);
            } else {
                doc = await lockStocktake(doc);
                onToast?.("Đã chốt phiếu", "success", 2000);
            }
            updateLockButton();
            render();
            await refreshHistory();
        } catch (error) {
            console.error(error);
            onToast?.(`Lỗi cập nhật trạng thái phiếu: ${error?.message || error}`, "error", 3000);
        }
    });

    exportBtn.addEventListener("click", () => {
        if (!doc) return;
        const rows = computeRows();
        const csvRows = [
            ["month", doc.month],
            ["warehouse", doc.warehouse],
            ["status", doc.status],
            [],
            ["product_id", "product_name", "system_qty", "counted_qty", "variance", "note"],
            ...rows.map((r) => [
                r.productId,
                r.name,
                r.systemQty ?? 0,
                r.counted ?? "",
                r.variance ?? "",
                r.note ?? "",
            ]),
        ];
        const csv = toCsv(csvRows);
        download(`kiem_kho_${doc.warehouse}_${doc.month}.csv`, csv);
        onToast?.("Đã xuất CSV", "success", 2000);
    });

    exportExcelBtn.addEventListener("click", async () => {
        if (!doc) return;
        try {
            const rows = computeRows();
            await exportStocktakeToExcel(
                doc,
                rows.map((r) => ({
                    productId: r.productId,
                    name: r.name,
                    categoryName: r.categoryName,
                    systemQty: r.systemQty,
                    counted: r.counted,
                    note: r.note,
                })),
                {
                    filename: `kiem_kho_${doc.warehouse}_${doc.month}`,
                }
            );
            onToast?.("Đã xuất Excel", "success", 2000);
        } catch (e) {
            console.error(e);
            onToast?.(`Lỗi xuất Excel: ${e?.message || e}`, "error", 3000);
        }
    });

    // Public API
    container.refresh = async () => {
        refreshWarehouses();
        await reloadAll();
    };

    // initial
    refreshWarehouses();
    reloadAll();

    return container;
}

