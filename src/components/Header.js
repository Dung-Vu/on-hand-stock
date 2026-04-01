import { createElement } from "../utils/dom.js";
import { auth } from "../services/apiClient.js";

// Inject header styles once
let _headerStylesInjected = false;
function injectHeaderStyles() {
    if (_headerStylesInjected) return;
    _headerStylesInjected = true;
    const style = document.createElement('style');
    style.id = 'header-styles';
    style.textContent = `
        .hdr-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            border: none;
            border-radius: 9px;
            font-family: inherit;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
            color: #ffffff;
            padding: 0 14px;
            height: 36px;
            font-size: 13px;
        }
        .hdr-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.2); }
        .hdr-btn:active { transform: translateY(0); box-shadow: none; }
        .hdr-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        /* ─── MOBILE DROPDOWN - fixed vào body, tính toán vị trí từ button ─── */
        .hdr-dropdown-portal {
            position: fixed;
            z-index: 9999;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 12px 40px rgba(42,35,31,0.22), 0 2px 8px rgba(42,35,31,0.10);
            border: 1px solid #e8ddd4;
            min-width: 230px;
            overflow: hidden;
            /* animation */
            transform-origin: top right;
            transform: scale(0.9) translateY(-8px);
            opacity: 0;
            pointer-events: none;
            transition: transform 0.22s cubic-bezier(0.16,1,0.3,1),
                        opacity 0.16s ease;
        }
        .hdr-dropdown-portal.open {
            transform: scale(1) translateY(0);
            opacity: 1;
            pointer-events: auto;
        }
        .hdr-dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
            font-family: inherit;
            font-size: 14px;
            font-weight: 500;
            color: #2a231f;
            cursor: pointer;
            transition: background 0.1s;
            box-sizing: border-box;
            min-height: 52px;
        }
        .hdr-dropdown-item:active { background: #f0ebe4; }
        .hdr-dropdown-item-icon {
            width: 36px; height: 36px;
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
        }
        .hdr-dropdown-item-label {
            font-size: 14px;
            font-weight: 600;
            color: #2a231f;
            line-height: 1.2;
        }
        .hdr-dropdown-item-sub {
            font-size: 11px;
            color: #9d8875;
            margin-top: 2px;
        }
        .hdr-dropdown-divider {
            height: 1px;
            background: #f0ebe4;
            margin: 2px 14px;
        }
        .hdr-dropdown-backdrop {
            position: fixed;
            inset: 0;
            z-index: 9998;
            background: transparent;
        }

        /* User badge chip */
        .hdr-user-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            border: 1.5px solid transparent;
            white-space: nowrap;
        }
    `;
    document.head.appendChild(style);
}

export default function Header({ onLoad, onExport, onExportPDF, onToggleStocktake, currentUser, onLogout, onOpenAdmin }) {
    injectHeaderStyles();

    const header = createElement("header", {});
    header.style.cssText = `
        background: #ffffff;
        position: sticky;
        top: 0;
        z-index: 50;
        border-bottom: 2px solid #d4c4b0;
        box-shadow: 0 2px 8px rgba(42,35,31,0.06);
        width: 100%;
        box-sizing: border-box;
    `;

    // ──────────────────────────────────────────────
    // TOP BAR
    // ──────────────────────────────────────────────
    const topBar = createElement("div", {});
    topBar.style.cssText = 'padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-sizing: border-box; width: 100%;';

    // LEFT: Logo + User chip
    const leftGroup = createElement("div", {});
    leftGroup.style.cssText = 'display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;';

    const logoBox = createElement("div", {});
    logoBox.style.cssText = `
        width: 36px; height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #6b5a45 0%, #8b7355 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(107,90,69,0.3);
    `;
    logoBox.textContent = '📦';

    const titleWrap = createElement("div", {});
    titleWrap.style.cssText = 'min-width: 0; overflow: hidden;';
    titleWrap.innerHTML = `
        <div style="font-size:15px; font-weight:800; color:#2a231f; letter-spacing:-0.2px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Bonario Stock</div>
        <div class="hidden-xs" style="font-size:11px; color:#9d8875; white-space:nowrap;">Tra cứu tồn kho</div>
    `;

    leftGroup.appendChild(logoBox);
    leftGroup.appendChild(titleWrap);

    // User chip (nếu đăng nhập)
    if (currentUser) {
        const chip = createElement("div", { class: 'hdr-user-chip' });
        const isAdmin = currentUser.role === 'admin';
        chip.style.cssText += isAdmin
            ? 'background: linear-gradient(135deg,#fef3c7,#fde68a); color:#92400e; border-color:#fde68a;'
            : 'background: linear-gradient(135deg,#d1fae5,#a7f3d0); color:#065f46; border-color:#a7f3d0;';
        // Truncate username nếu dài
        const maxLen = 10;
        const displayName = currentUser.username.length > maxLen
            ? currentUser.username.slice(0, maxLen) + '…'
            : currentUser.username;
        chip.innerHTML = `<span>${isAdmin ? '👑' : '🔍'}</span><span>${displayName}</span>`;
        leftGroup.appendChild(chip);
    }

    // RIGHT: Desktop buttons + Mobile menu button
    const rightGroup = createElement("div", {});
    rightGroup.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-shrink: 0;';

    // ─── DESKTOP BUTTONS (hidden on mobile) ───
    const desktopBtns = createElement("div", {});
    desktopBtns.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    desktopBtns.className = 'desktop-header-btns';

    // Inject responsive hide rule
    if (!document.getElementById('hdr-responsive-style')) {
        const rs = document.createElement('style');
        rs.id = 'hdr-responsive-style';
        rs.textContent = `
            @media (max-width: 639px) {
                .desktop-header-btns { display: none !important; }
                .mobile-menu-btn { display: block !important; }
            }
            @media (min-width: 640px) {
                .mobile-menu-btn { display: none !important; }
            }
        `;
        document.head.appendChild(rs);
    }

    function makeBtn(emoji, label, color, onClick) {
        const btn = createElement("button", { class: 'hdr-btn', title: label });
        btn.style.background = color;
        btn.innerHTML = `<span>${emoji}</span><span>${label}</span>`;
        btn.addEventListener("click", onClick);
        return btn;
    }

    if (currentUser?.role === 'admin') {
        desktopBtns.appendChild(makeBtn('👑', 'Admin', 'linear-gradient(135deg,#f59e0b,#d97706)', () => onOpenAdmin?.()));
    }
    desktopBtns.appendChild(makeBtn('🧾', 'Kiểm kho', 'linear-gradient(135deg,#6366f1,#4f46e5)', () => onToggleStocktake?.()));
    desktopBtns.appendChild(makeBtn('🔄', 'Tải lại', 'linear-gradient(135deg,#6b5a45,#8b7355)', () => onLoad?.()));
    desktopBtns.appendChild(makeBtn('📊', 'Excel', 'linear-gradient(135deg,#10b981,#059669)', () => onExport?.()));
    desktopBtns.appendChild(makeBtn('📄', 'PDF', 'linear-gradient(135deg,#ef4444,#dc2626)', () => onExportPDF?.()));
    if (currentUser) {
        desktopBtns.appendChild(makeBtn('🚪', 'Logout', 'linear-gradient(135deg,#6b7280,#4b5563)', () => onLogout?.()));
    }

    // ─── MOBILE MENU BUTTON + DROPDOWN (portal vào body) ───
    const mobileDropdownWrap = createElement("div", { class: 'mobile-menu-btn' });
    mobileDropdownWrap.style.cssText = 'display: none; position: relative;';

    const mobileMenuBtn = createElement("button", { class: 'hdr-btn' });
    mobileMenuBtn.style.cssText = `
        background: linear-gradient(135deg,#6b5a45,#8b7355);
        padding: 0 14px;
        gap: 5px;
        font-size: 13px;
        height: 36px;
        font-weight: 700;
    `;
    mobileMenuBtn.title = 'Menu';
    mobileMenuBtn.innerHTML = '☰ <span>More</span>';

    // Portal panel - gắn trực tiếp vào document.body để tránh bị clip bởi overflow:hidden
    const dropdownPortal = createElement("div", { class: 'hdr-dropdown-portal' });
    let dropdownOpen = false;
    let backdropEl = null;

    function positionPortal() {
        const rect = mobileMenuBtn.getBoundingClientRect();
        const panelWidth = 240;
        const margin = 8;
        // Canh phải theo nút, không vượt qua mép trái màn hình
        let left = rect.right - panelWidth;
        if (left < margin) left = margin;
        dropdownPortal.style.top  = (rect.bottom + 8) + 'px';
        dropdownPortal.style.left = left + 'px';
        dropdownPortal.style.width = panelWidth + 'px';
    }

    function openDropdown() {
        if (dropdownOpen) { closeDropdown(); return; }
        dropdownOpen = true;
        mobileMenuBtn.innerHTML = '✕ <span>Close</span>';
        // Gắn portal vào body
        document.body.appendChild(dropdownPortal);
        positionPortal();
        // Backdrop
        backdropEl = createElement("div", { class: 'hdr-dropdown-backdrop' });
        backdropEl.addEventListener('click', closeDropdown);
        document.body.appendChild(backdropEl);
        // Trigger animation sau 1 frame
        requestAnimationFrame(() => {
            dropdownPortal.classList.add('open');
        });
    }

    function closeDropdown() {
        if (!dropdownOpen) return;
        dropdownOpen = false;
        mobileMenuBtn.innerHTML = '☰ <span>More</span>';
        dropdownPortal.classList.remove('open');
        if (backdropEl) { backdropEl.remove(); backdropEl = null; }
        // Xóa portal khỏi body sau animation
        setTimeout(() => {
            if (dropdownPortal.parentNode === document.body) {
                document.body.removeChild(dropdownPortal);
            }
        }, 220);
    }

    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDropdown();
    });

    // Reposition on scroll/resize
    window.addEventListener('resize', () => { if (dropdownOpen) positionPortal(); });

    // Helper tạo dropdown item
    function dropdownItem(emoji, iconBg, label, sub, onClick, danger = false) {
        const btn = createElement("button", { class: 'hdr-dropdown-item' });
        const iconEl = createElement("div", { class: 'hdr-dropdown-item-icon' });
        iconEl.style.background = iconBg;
        iconEl.textContent = emoji;
        const textEl = createElement("div", { style: 'flex:1; min-width:0;' });
        textEl.innerHTML = `
            <div class="hdr-dropdown-item-label"${danger ? ' style="color:#dc2626;"' : ''}>${label}</div>
            <div class="hdr-dropdown-item-sub">${sub}</div>
        `;
        btn.appendChild(iconEl);
        btn.appendChild(textEl);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDropdown();
            setTimeout(onClick, 80);
        });
        return btn;
    }

    function dropdownDivider() {
        return createElement("div", { class: 'hdr-dropdown-divider' });
    }

    // Build menu items theo role
    if (currentUser?.role === 'admin') {
        dropdownPortal.appendChild(dropdownItem('👑', 'linear-gradient(135deg,#fef3c7,#fde68a)', 'Admin Dashboard', 'Quản lý tài khoản', () => onOpenAdmin?.()));
        dropdownPortal.appendChild(dropdownDivider());
    }
    dropdownPortal.appendChild(dropdownItem('🧾', 'linear-gradient(135deg,#ede9fe,#ddd6fe)', 'Kiểm kho', 'Kiểm kê hàng tháng', () => onToggleStocktake?.()));
    dropdownPortal.appendChild(dropdownItem('🔄', 'linear-gradient(135deg,#f5f1ea,#e8ddd4)', 'Tải lại dữ liệu', 'Cập nhật tồn kho mới nhất', () => onLoad?.()));
    dropdownPortal.appendChild(dropdownDivider());
    dropdownPortal.appendChild(dropdownItem('📊', 'linear-gradient(135deg,#d1fae5,#a7f3d0)', 'Xuất Excel', 'Tải file .xlsx', () => onExport?.()));
    dropdownPortal.appendChild(dropdownItem('📄', 'linear-gradient(135deg,#fee2e2,#fecaca)', 'Xuất PDF', 'Tải file .pdf', () => onExportPDF?.()));
    if (currentUser) {
        dropdownPortal.appendChild(dropdownDivider());
        dropdownPortal.appendChild(dropdownItem('🚪', 'linear-gradient(135deg,#f5f5f5,#e5e5e5)', 'Đăng xuất', `Thoát: ${currentUser.username}`, () => onLogout?.(), true));
    }

    mobileDropdownWrap.appendChild(mobileMenuBtn);

    rightGroup.appendChild(desktopBtns);
    rightGroup.appendChild(mobileDropdownWrap);

    topBar.appendChild(leftGroup);
    topBar.appendChild(rightGroup);
    header.appendChild(topBar);

    // ──────────────────────────────────────────────
    // SEARCH SECTION
    // ──────────────────────────────────────────────
    const searchSection = createElement("div", {
        id: "headerSearchSection",
    });
    searchSection.style.cssText = `
        padding: 8px 16px 10px;
        background: linear-gradient(to bottom, #ffffff, #faf8f5);
        border-bottom: 1px solid #e8ddd4;
        box-sizing: border-box;
        width: 100%;
    `;

    const searchWrap = createElement("div", {});
    searchWrap.style.cssText = 'max-width: 720px; margin: 0 auto; position: relative;';

    const searchIcon = createElement("span", {});
    searchIcon.style.cssText = `
        position: absolute; left: 12px; top: 50%;
        transform: translateY(-50%);
        font-size: 15px; pointer-events: none;
        color: #9d8875;
    `;
    searchIcon.textContent = '🔍';

    const searchInput = createElement("input", {
        id: "searchInput",
        type: "text",
        placeholder: "Tìm kiếm sản phẩm...",
    });
    searchInput.style.cssText = `
        width: 100%;
        height: 40px;
        padding: 0 12px 0 38px;
        border-radius: 10px;
        border: 1.5px solid #d4c4b0;
        background: #ffffff;
        font-size: 14px;
        color: #2a231f;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
        font-family: inherit;
    `;
    searchInput.addEventListener("focus", () => {
        searchInput.style.borderColor = "#8b6b4f";
        searchInput.style.boxShadow = "0 0 0 3px rgba(139,107,79,0.12)";
    });
    searchInput.addEventListener("blur", () => {
        searchInput.style.borderColor = "#d4c4b0";
        searchInput.style.boxShadow = "none";
    });

    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);
    searchSection.appendChild(searchWrap);

    // ──────────────────────────────────────────────
    // FILTERS SECTION
    // ──────────────────────────────────────────────
    const filtersSection = createElement("div", {
        id: "headerFiltersSection",
    });
    filtersSection.style.cssText = `
        padding: 6px 16px 8px;
        background: #faf8f5;
        border-bottom: 1px solid #e8ddd4;
        box-sizing: border-box;
        width: 100%;
    `;

    const filtersContent = createElement("div", {});
    filtersContent.style.cssText = 'max-width: 720px; margin: 0 auto; display: flex; align-items: center; gap: 8px;';

    const categoryFilter = createElement("select", {
        id: "categoryFilter",
    });
    categoryFilter.style.cssText = `
        flex: 1;
        height: 34px;
        padding: 0 10px;
        border-radius: 8px;
        border: 1.5px solid #d4c4b0;
        background: #ffffff;
        font-size: 13px;
        color: #2a231f;
        outline: none;
        font-family: inherit;
        cursor: pointer;
    `;
    const defaultOpt = createElement("option", { value: "" });
    defaultOpt.textContent = "Tất cả nhóm sản phẩm";
    categoryFilter.appendChild(defaultOpt);

    const clearBtn = createElement("button", { id: "clearFiltersBtn" });
    clearBtn.style.cssText = `
        height: 34px;
        padding: 0 12px;
        border-radius: 8px;
        border: 1.5px solid #d4c4b0;
        background: transparent;
        color: #8b7355;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s, border-color 0.15s;
        font-family: inherit;
    `;
    clearBtn.textContent = '✕ Xóa';
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

    // ──────────────────────────────────────────────
    // WAREHOUSE TABS
    // ──────────────────────────────────────────────
    const warehouseTabsSection = createElement("div", {
        id: "warehouseTabsPlaceholder",
        class: "bg-white",
    });
    warehouseTabsSection.style.cssText = 'border-bottom: 2px solid #d4c4b0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); width: 100%; box-sizing: border-box;';

    header.appendChild(topBar);
    header.appendChild(searchSection);
    header.appendChild(filtersSection);
    header.appendChild(warehouseTabsSection);

    // ──────────────────────────────────────────────
    // EVENT LISTENERS (debounced search)
    // ──────────────────────────────────────────────
    let searchTimeout = null;
    function triggerFilterChange() {
        const event = new CustomEvent("filterChange");
        document.dispatchEvent(event);
    }
    function debounced() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(triggerFilterChange, 300);
    }

    searchInput.addEventListener("input", debounced);
    categoryFilter.addEventListener("change", triggerFilterChange);
    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        categoryFilter.value = "";
        triggerFilterChange();
    });

    return header;
}
