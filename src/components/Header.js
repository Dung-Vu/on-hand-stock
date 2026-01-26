import { createElement } from "../utils/dom.js";

export default function Header({ onLoad, onExport, onExportPDF }) {
    const header = createElement("header", {
        class: "bg-white shadow-sm z-50",
    });
    header.style.position = "sticky";
    header.style.top = "0";
    header.style.borderBottom = "2px solid #d4c4b0";

    // Top bar with branding and actions
    const topBar = createElement("div", {
        class: "px-4 py-2",
    });

    const topBarContent = createElement("div", {
        class: "flex items-center justify-between flex-wrap gap-2",
    });

    // Left: Branding
    const branding = createElement("div", {
        class: "flex items-center gap-2",
    });

    const icon = createElement("div", {
        class: "w-8 h-8 rounded-lg flex items-center justify-center text-xl",
    });
    icon.style.background = "linear-gradient(135deg, #6b5a45 0%, #8b7355 100%)";
    icon.innerHTML = "📦";

    const titleSection = createElement("div", {});

    const title = createElement("h1", {
        class: "text-base font-bold",
    });
    title.style.color = "#2a231f";
    title.textContent = "Kiểm kho nhanh";

    const subtitle = createElement("p", {
        class: "text-xs hidden sm:block",
    });
    subtitle.style.color = "#7d6d5a";
    subtitle.textContent = "Tra cứu tồn kho cho đội ngũ sales";

    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);
    branding.appendChild(icon);
    branding.appendChild(titleSection);

    // Right: Action buttons
    const buttonGroup = createElement("div", {
        class: "flex items-center gap-2",
    });

    const loadBtn = createElement("button", {
        id: "loadDataBtn",
        class: "btn-primary text-xs flex items-center gap-1 px-3 py-2",
    });
    loadBtn.innerHTML =
        '<span>🔄</span><span class="hidden sm:inline">Tải dữ liệu</span>';
    loadBtn.addEventListener("click", onLoad);

    // Excel export button
    const exportExcelBtn = createElement("button", {
        id: "exportExcelBtn",
        class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all",
    });
    exportExcelBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
    exportExcelBtn.style.color = "white";
    exportExcelBtn.innerHTML =
        '<span>📊</span><span class="hidden sm:inline">Excel</span>';
    exportExcelBtn.addEventListener("click", onExport);
    exportExcelBtn.addEventListener("mouseenter", () => {
        exportExcelBtn.style.transform = "scale(1.05)";
    });
    exportExcelBtn.addEventListener("mouseleave", () => {
        exportExcelBtn.style.transform = "scale(1)";
    });

    // PDF export button
    const exportPDFBtn = createElement("button", {
        id: "exportPDFBtn",
        class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all",
    });
    exportPDFBtn.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
    exportPDFBtn.style.color = "white";
    exportPDFBtn.innerHTML =
        '<span>📄</span><span class="hidden sm:inline">PDF</span>';
    exportPDFBtn.addEventListener("click", onExportPDF);
    exportPDFBtn.addEventListener("mouseenter", () => {
        exportPDFBtn.style.transform = "scale(1.05)";
    });
    exportPDFBtn.addEventListener("mouseleave", () => {
        exportPDFBtn.style.transform = "scale(1)";
    });

    buttonGroup.appendChild(loadBtn);
    buttonGroup.appendChild(exportExcelBtn);
    buttonGroup.appendChild(exportPDFBtn);

    topBarContent.appendChild(branding);
    topBarContent.appendChild(buttonGroup);
    topBar.appendChild(topBarContent);

    // Search section
    const searchSection = createElement("div", {
        class: "px-4 py-3",
    });
    searchSection.style.background =
        "linear-gradient(to bottom, #ffffff, #faf8f5)";
    searchSection.style.borderBottom = "1px solid #e8ddd4";

    const searchHero = createElement("div", {
        class: "max-w-3xl mx-auto",
    });

    const searchInput = createElement("input", {
        id: "searchInput",
        type: "text",
        placeholder: "🔍 Tìm kiếm sản phẩm...",
        class: "w-full px-4 py-2.5 rounded-lg text-base",
    });
    searchInput.style.border = "2px solid #d4c4b0";
    searchInput.style.transition = "all 0.2s";
    searchInput.addEventListener("focus", () => {
        searchInput.style.borderColor = "#6b5a45";
        searchInput.style.boxShadow = "0 4px 12px rgba(107, 90, 69, 0.1)";
    });
    searchInput.addEventListener("blur", () => {
        searchInput.style.borderColor = "#d4c4b0";
        searchInput.style.boxShadow = "none";
    });

    searchHero.appendChild(searchInput);
    searchSection.appendChild(searchHero);

    // Quick filters section
    const filtersSection = createElement("div", {
        class: "px-4 py-2",
    });
    filtersSection.style.backgroundColor = "#faf8f5";
    filtersSection.style.borderBottom = "1px solid #e8ddd4";

    const filtersContent = createElement("div", {
        class: "flex items-center gap-2 flex-wrap max-w-3xl mx-auto",
    });

    const categoryFilter = createElement("select", {
        id: "categoryFilter",
        class: "px-3 py-1.5 rounded-lg text-sm flex-1 min-w-[150px]",
    });
    categoryFilter.style.border = "1px solid #d4c4b0";
    categoryFilter.style.backgroundColor = "white";
    const categoryOption = createElement(
        "option",
        { value: "" },
        "Tất cả nhóm sản phẩm"
    );
    categoryFilter.appendChild(categoryOption);

    const clearBtn = createElement("button", {
        id: "clearFiltersBtn",
        class: "px-3 py-1.5 text-xs rounded-lg transition-all",
    });
    clearBtn.style.border = "1px solid #d4c4b0";
    clearBtn.style.color = "#8b7355";
    clearBtn.style.backgroundColor = "transparent";
    clearBtn.textContent = "✕ Xóa";
    clearBtn.addEventListener("mouseenter", () => {
        clearBtn.style.backgroundColor = "#f5f1ea";
        clearBtn.style.borderColor = "#c9b99e";
    });
    clearBtn.addEventListener("mouseleave", () => {
        clearBtn.style.backgroundColor = "transparent";
        clearBtn.style.borderColor = "#d4c4b0";
    });

    filtersContent.appendChild(categoryFilter);
    filtersContent.appendChild(clearBtn);
    filtersSection.appendChild(filtersContent);

    // Query Builder section (advanced filtering)
    const queryBuilderSection = createElement("div", {
        id: "queryBuilderContainer",
        class: "px-4 py-2",
    });
    queryBuilderSection.style.backgroundColor = "#ffffff";
    queryBuilderSection.style.borderBottom = "1px solid #e8ddd4";
    queryBuilderSection.innerHTML = `
        <div class="max-w-3xl mx-auto">
            <!-- Query Builder will be initialized here by dataStore.js -->
        </div>
    `;

    // Warehouse tabs section
    const warehouseTabsSection = createElement("div", {
        id: "warehouseTabsPlaceholder",
        class: "bg-white",
    });
    warehouseTabsSection.style.borderBottom = "2px solid #d4c4b0";
    warehouseTabsSection.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";

    header.appendChild(topBar);
    header.appendChild(searchSection);
    header.appendChild(filtersSection);
    header.appendChild(queryBuilderSection);
    header.appendChild(warehouseTabsSection);

    // Debounce helper function
    let searchTimeout = null;
    const debounce = (fn, delay) => {
        return (...args) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => fn(...args), delay);
        };
    };

    // Event listeners with debounced search
    const triggerFilterChange = () => {
        const event = new CustomEvent("filterChange");
        document.dispatchEvent(event);
    };

    // Debounce search input (300ms delay)
    searchInput.addEventListener("input", debounce(triggerFilterChange, 300));

    categoryFilter.addEventListener("change", triggerFilterChange);

    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        categoryFilter.value = "";
        triggerFilterChange();
    });

    return header;
}
