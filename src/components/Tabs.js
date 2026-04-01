import { createElement } from "../utils/dom.js";

export default function Tabs({ warehouses, activeWarehouse, onTabChange }) {
    const tabsContainer = createElement("div", {});
    tabsContainer.style.cssText = "background-color: #faf8f5; padding: 8px 12px 10px; width: 100%; box-sizing: border-box; overflow: hidden;";

    const centerWrapper = createElement("div", {});
    centerWrapper.style.cssText = "max-width: 960px; margin: 0 auto; width: 100%; box-sizing: border-box;";

    // Header label
    const tabsHeader = createElement("div", {});
    tabsHeader.style.cssText = "display: flex; align-items: center; gap: 6px; margin-bottom: 8px;";
    tabsHeader.innerHTML = `<span style="font-size:13px;">🏪</span><span style="font-size:11px; font-weight:600; color:#5d5044; text-transform:uppercase; letter-spacing:0.5px;">Chọn kho</span>`;

    // Handle warehouses - can be object with groups or array
    let warehouseGroups = warehouses;
    if (Array.isArray(warehouses)) {
        warehouseGroups = { all: warehouses };
    }

    // Gom tất cả kho thành danh sách hiển thị theo thứ tự
    const productList = warehouseGroups.productGroup || [];
    const fabricList  = warehouseGroups.fabricGroup  || [];
    const otherList   = warehouseGroups.otherGroup   || [];
    const allList     = warehouseGroups.all           || [];

    // Nếu không có groups thì dùng all
    const hasGroups = productList.length > 0 || fabricList.length > 0;

    // Container bao toàn bộ tabs - flex-wrap: tự xuống hàng, không scroll ngang
    const allTabsContainer = createElement("div", {});
    allTabsContainer.style.cssText = "width: 100%; box-sizing: border-box;";

    // Helper tạo tab button
    const createTab = (warehouseName) => {
        const isActive = warehouseName === activeWarehouse;
        const shortName = warehouseName.replace("/Stock", "");

        const tab = createElement("button", {
            "data-warehouse": warehouseName,
        });
        tab.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border-radius: 8px;
            font-family: inherit;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
            outline: none;
            border: 1.5px solid ${isActive ? 'transparent' : '#d4c4b0'};
            background: ${isActive ? 'linear-gradient(135deg,#6b5a45,#8b7355)' : '#ffffff'};
            color: ${isActive ? '#ffffff' : '#5d5044'};
            box-shadow: ${isActive ? '0 2px 8px rgba(107,90,69,0.28)' : 'none'};
        `;
        if (isActive) {
            tab.classList.add('tab-active', 'tab-pill-active');
        } else {
            tab.classList.add('tab-pill-inactive');
        }

        if (isActive) {
            tab.innerHTML = `<span style="font-size:10px;">✓</span><span>${shortName}</span>`;
        } else {
            tab.textContent = shortName;
        }

        tab.addEventListener('mouseenter', () => {
            if (!tab.classList.contains('tab-active')) {
                tab.style.background = '#f5f1ea';
                tab.style.borderColor = '#c9b99e';
            }
        });
        tab.addEventListener('mouseleave', () => {
            if (!tab.classList.contains('tab-active')) {
                tab.style.background = '#ffffff';
                tab.style.borderColor = '#d4c4b0';
            }
        });

        tab.addEventListener("click", () => {
            // Reset all tabs
            allTabsContainer.querySelectorAll("button[data-warehouse]").forEach((t) => {
                t.classList.remove("tab-active", "tab-pill-active");
                t.classList.add("tab-pill-inactive");
                t.style.background = "#ffffff";
                t.style.color = "#5d5044";
                t.style.border = "1.5px solid #d4c4b0";
                t.style.boxShadow = "none";
                const wh = t.getAttribute('data-warehouse');
                t.textContent = wh ? wh.replace('/Stock', '') : t.textContent;
            });
            // Activate clicked tab
            tab.classList.add("tab-active", "tab-pill-active");
            tab.classList.remove("tab-pill-inactive");
            tab.style.background = "linear-gradient(135deg,#6b5a45,#8b7355)";
            tab.style.color = "#ffffff";
            tab.style.border = "1.5px solid transparent";
            tab.style.boxShadow = "0 2px 8px rgba(107,90,69,0.28)";
            tab.innerHTML = `<span style="font-size:10px;">✓</span><span>${shortName}</span>`;

            onTabChange(warehouseName);
        });

        return tab;
    };

    if (hasGroups) {
        // --- Nhóm sản phẩm ---
        if (productList.length > 0) {
            const row = createElement("div", {});
            row.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;";
            productList.forEach((name) => row.appendChild(createTab(name)));
            allTabsContainer.appendChild(row);
        }
        // --- Nhóm vải + khác ---
        const fabricAll = [...fabricList, ...otherList];
        if (fabricAll.length > 0) {
            const row = createElement("div", {});
            row.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px;";
            fabricAll.forEach((name) => row.appendChild(createTab(name)));
            allTabsContainer.appendChild(row);
        }
    } else {
        // Fallback: all in one wrap row
        const row = createElement("div", {});
        row.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px;";
        allList.forEach((name) => row.appendChild(createTab(name)));
        allTabsContainer.appendChild(row);
    }

    centerWrapper.appendChild(tabsHeader);
    centerWrapper.appendChild(allTabsContainer);
    tabsContainer.appendChild(centerWrapper);

    return tabsContainer;
}