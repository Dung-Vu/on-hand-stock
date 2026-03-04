import { createElement } from "../utils/dom.js";

export default function Tabs({ warehouses, activeWarehouse, onTabChange }) {
    const tabsContainer = createElement("div", {
        class: "py-2 px-3",
    });
    tabsContainer.style.backgroundColor = "#faf8f5";

    const centerWrapper = createElement("div", {
        class: "max-w-5xl mx-auto",
    });

    // Header with icon
    const tabsHeader = createElement("div", {
        class: "flex items-center gap-1.5 mb-2 px-1",
    });

    const headerIcon = createElement("span", { class: "text-sm" });
    headerIcon.innerHTML = "🏪";

    const headerText = createElement("span", {
        class: "text-xs font-semibold",
    });
    headerText.style.color = "#5d5044";
    headerText.textContent = "Chọn kho:";

    tabsHeader.appendChild(headerIcon);
    tabsHeader.appendChild(headerText);

    // Main container for all tab groups
    const allTabsContainer = createElement("div", {
        // On mobile: stack rows vertically with horizontal scroll
        // On desktop: become a single row, centered
        class: "flex flex-col items-center md:flex-row md:justify-center gap-y-2 md:gap-x-1.5 w-full overflow-x-auto md:overflow-visible",
    });
    allTabsContainer.style.maxWidth = "100%";

    // Helper function to create a tab
    const createTab = (warehouseName) => {
        const isActive = warehouseName === activeWarehouse;
        const shortName = warehouseName.replace("/Stock", "");

        const tab = createElement("button", {
            class: `px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                isActive ? "tab-pill-active tab-active" : "tab-pill-inactive"
            }`,
            "data-warehouse": warehouseName,
            tabindex: "0",
        });

        if (isActive) {
            tab.style.background = "linear-gradient(135deg, #6b5a45 0%, #8b7355 100%)";
            tab.style.color = "#ffffff";
            tab.style.boxShadow = "0 2px 8px rgba(107, 90, 69, 0.3)";
        } else {
            tab.style.backgroundColor = "#ffffff";
            tab.style.color = "#5d5044";
            tab.style.border = "1.5px solid #d4c4b0";
        }
        // Focus ring for keyboard navigation
        tab.style.outline = "none";
        tab.addEventListener('focus', () => {
            tab.style.boxShadow = "0 0 0 3px rgba(107, 90, 69, 0.4)";
        });
        tab.addEventListener('blur', () => {
            if (!isActive) {
                tab.style.boxShadow = "none";
            } else {
                tab.style.boxShadow = "0 2px 8px rgba(107, 90, 69, 0.3)";
            }
        });

        const tabContent = createElement("div", { class: "flex items-center gap-1" });

        if (isActive) {
            const checkIcon = createElement("span", { class: "text-xs" });
            checkIcon.textContent = "✓";
            tabContent.appendChild(checkIcon);
        }

        const tabText = createElement("span", {});
        tabText.textContent = shortName;

        tabContent.appendChild(tabText);
        tab.appendChild(tabContent);

        tab.addEventListener("click", () => {
            const allButtons = allTabsContainer.querySelectorAll("button");
            allButtons.forEach((t) => {
                t.classList.remove("tab-active", "tab-pill-active");
                t.classList.add("tab-pill-inactive");
                t.style.background = "#ffffff";
                t.style.color = "#5d5044";
                t.style.border = "1.5px solid #d4c4b0";
                t.style.boxShadow = "none";
                const content = t.querySelector("div");
                if (content && content.firstChild && content.firstChild.textContent === "✓") {
                    content.removeChild(content.firstChild);
                }
            });

            tab.classList.add("tab-active", "tab-pill-active");
            tab.classList.remove("tab-pill-inactive");
            tab.style.background = "linear-gradient(135deg, #6b5a45 0%, #8b7355 100%)";
            tab.style.color = "#ffffff";
            tab.style.border = "none";
            tab.style.boxShadow = "0 2px 8px rgba(107, 90, 69, 0.3)";

            const content = tab.querySelector("div");
            if (content && (!content.firstChild || content.firstChild.textContent !== "✓")) {
                const checkIcon = createElement("span", { class: "text-xs" });
                checkIcon.textContent = "✓";
                content.insertBefore(checkIcon, content.firstChild);
            }

            onTabChange(warehouseName);
        });

        return tab;
    };

    // Handle warehouses - can be object with groups or array
    let warehouseGroups = warehouses;
    if (Array.isArray(warehouses)) {
        warehouseGroups = { all: warehouses };
    }

    const productTabsRow = createElement("div", {
        class: "flex flex-wrap items-center justify-center gap-1",
    });
    // Enable horizontal scroll on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
        productTabsRow.classList.remove("flex-wrap");
        productTabsRow.classList.add("flex-nowrap", "overflow-x-auto", "pb-2");
        productTabsRow.style.webkitOverflowScrolling = "touch";
    }
    
    const fabricTabsRow = createElement("div", {
        class: "flex flex-wrap items-center justify-center gap-1",
    });
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
        fabricTabsRow.classList.remove("flex-wrap");
        fabricTabsRow.classList.add("flex-nowrap", "overflow-x-auto", "pb-2");
        fabricTabsRow.style.webkitOverflowScrolling = "touch";
    }

    // Render product group
    if (warehouseGroups.productGroup) {
        warehouseGroups.productGroup.forEach((name) => productTabsRow.appendChild(createTab(name)));
    }

    // Render fabric group
    if (warehouseGroups.fabricGroup) {
        warehouseGroups.fabricGroup.forEach((name) => fabricTabsRow.appendChild(createTab(name)));
    }
    
    // Render other group (append to fabric row as it's also fabric-related)
    if (warehouseGroups.otherGroup) {
        warehouseGroups.otherGroup.forEach((name) => fabricTabsRow.appendChild(createTab(name)));
    }

    // Fallback for ungrouped data
    if (!warehouseGroups.productGroup && !warehouseGroups.fabricGroup && warehouseGroups.all) {
        warehouseGroups.all.forEach((name) => productTabsRow.appendChild(createTab(name)));
    }

    if (productTabsRow.hasChildNodes()) allTabsContainer.appendChild(productTabsRow);
    if (fabricTabsRow.hasChildNodes()) allTabsContainer.appendChild(fabricTabsRow);

    centerWrapper.appendChild(tabsHeader);
    centerWrapper.appendChild(allTabsContainer);
    tabsContainer.appendChild(centerWrapper);

    return tabsContainer;
}