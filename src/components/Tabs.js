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
        // On mobile: stack rows vertically, center items
        // On desktop: become a single row, centered
        class: "flex flex-col items-center md:flex-row md:justify-center gap-y-2 md:gap-x-1.5",
    });

    // Helper function to create a tab
    const createTab = (warehouseName) => {
        const isActive = warehouseName === activeWarehouse;
        const shortName = warehouseName.replace("/Stock", "");

        const tab = createElement("button", {
            class: `px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-all duration-200 ${
                isActive ? "tab-pill-active tab-active" : "tab-pill-inactive"
            }`,
            "data-warehouse": warehouseName,
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
    const fabricTabsRow = createElement("div", {
        class: "flex flex-wrap items-center justify-center gap-1",
    });

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