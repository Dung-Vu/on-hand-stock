import { createElement } from "../utils/dom.js";
import { auth } from "../services/apiClient.js";

export default function Header({ onLoad, onExport, onExportPDF, onToggleStocktake, currentUser, onLogout, onOpenAdmin }) {
    const header = createElement("header", {
        class: "bg-white shadow-sm z-50",
    });
    header.style.position = "sticky";
    header.style.top = "0";
    header.style.borderBottom = "2px solid #d4c4b0";

    // Top bar with branding and actions
    const topBar = createElement("div", {
        class: "px-3 py-2 sm:px-4",
    });

    const topBarContent = createElement("div", {
        class: "flex items-center justify-between flex-wrap gap-2",
    });
    // Stack vertically on very small screens
    if (typeof window !== 'undefined' && window.innerWidth < 480) {
        topBarContent.classList.add("flex-col", "items-stretch");
    }

    // Left: Branding + User Info
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

    // User info (if logged in)
    if (currentUser) {
        const userInfo = createElement("div", {
            class: "ml-4 flex items-center gap-2",
        });
        
        const userBadge = createElement("div", {
            class: "px-2 py-1 rounded text-xs font-semibold",
        });
        userBadge.style.background = currentUser.role === 'admin' 
            ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
            : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
        userBadge.style.color = currentUser.role === 'admin' ? '#92400e' : '#065f46';
        userBadge.innerHTML = `${currentUser.role === 'admin' ? '👑' : '🔍'} ${currentUser.username}`;
        
        userInfo.appendChild(userBadge);
        branding.appendChild(userInfo);
    }

    // Right: Action buttons
    const buttonGroup = createElement("div", {
        class: "flex items-center gap-2 flex-wrap",
    });
    // Full width buttons on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 480) {
        buttonGroup.classList.add("justify-between");
    }

    // Admin button (admin only)
    if (currentUser && currentUser.role === 'admin') {
        const adminBtn = createElement("button", {
            class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all",
            title: "Admin Dashboard",
        });
        adminBtn.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
        adminBtn.style.color = "white";
        adminBtn.innerHTML = '<span>👑</span><span class="hidden sm:inline">Admin</span>';
        adminBtn.addEventListener("click", () => onOpenAdmin?.());
        adminBtn.addEventListener("mouseenter", () => {
            adminBtn.style.transform = "scale(1.05)";
        });
        adminBtn.addEventListener("mouseleave", () => {
            adminBtn.style.transform = "scale(1)";
        });
        buttonGroup.appendChild(adminBtn);
    }

    const stocktakeBtn = createElement("button", {
        id: "stocktakeBtn",
        class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 md:flex-none justify-center",
        title: "Kiểm kho hàng tháng",
    });
    stocktakeBtn.style.background = "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
    stocktakeBtn.style.color = "white";
    stocktakeBtn.innerHTML =
        '<span>🧾</span><span class="hidden sm:inline">Kiểm kho</span>';
    stocktakeBtn.addEventListener("click", () => onToggleStocktake?.());
    stocktakeBtn.addEventListener("mouseenter", () => {
        stocktakeBtn.style.transform = "scale(1.05)";
    });
    stocktakeBtn.addEventListener("mouseleave", () => {
        stocktakeBtn.style.transform = "scale(1)";
    });

    const loadBtn = createElement("button", {
        id: "loadDataBtn",
        class: "btn-primary text-xs flex items-center gap-1 px-3 py-2 flex-1 md:flex-none justify-center",
    });
    loadBtn.innerHTML =
        '<span>🔄</span><span class="hidden sm:inline">Tải dữ liệu</span>';
    loadBtn.addEventListener("click", onLoad);

    // Excel export button
    const exportExcelBtn = createElement("button", {
        id: "exportExcelBtn",
        class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 md:flex-none justify-center",
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
        class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 md:flex-none justify-center",
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

    buttonGroup.appendChild(stocktakeBtn);
    buttonGroup.appendChild(loadBtn);
    buttonGroup.appendChild(exportExcelBtn);
    buttonGroup.appendChild(exportPDFBtn);

    // Login/Logout button
    if (currentUser) {
        // Logged in - show Logout
        const logoutBtn = createElement("button", {
            class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all",
            title: "Đăng xuất",
        });
        logoutBtn.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
        logoutBtn.style.color = "white";
        logoutBtn.innerHTML = '<span>🚪</span><span class="hidden sm:inline">Logout</span>';
        logoutBtn.addEventListener("click", () => onLogout?.());
        logoutBtn.addEventListener("mouseenter", () => {
            logoutBtn.style.transform = "scale(1.05)";
        });
        logoutBtn.addEventListener("mouseleave", () => {
            logoutBtn.style.transform = "scale(1)";
        });
        buttonGroup.appendChild(logoutBtn);
    } else {
        // Not logged in - show Login button
        const loginBtn = createElement("button", {
            class: "text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all",
            title: "Đăng nhập để Kiểm kho",
        });
        loginBtn.style.background = "linear-gradient(135deg, #6b5a45 0%, #8b7355 100%)";
        loginBtn.style.color = "white";
        loginBtn.innerHTML = '<span>🔑</span><span class="hidden sm:inline">Login</span>';
        loginBtn.addEventListener("click", () => {
            // Trigger stocktake which will show login modal
            onToggleStocktake?.();
        });
        loginBtn.addEventListener("mouseenter", () => {
            loginBtn.style.transform = "scale(1.05)";
        });
        loginBtn.addEventListener("mouseleave", () => {
            loginBtn.style.transform = "scale(1)";
        });
        buttonGroup.appendChild(loginBtn);
    }

    topBarContent.appendChild(branding);
    topBarContent.appendChild(buttonGroup);
    topBar.appendChild(topBarContent);

    // Search section
    const searchSection = createElement("div", {
        id: "headerSearchSection",
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
        id: "headerFiltersSection",
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
