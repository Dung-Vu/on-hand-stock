const STORAGE_PREFIX = "stocktake:v1";

function ymKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

export function makeStocktakeKey({ month, warehouse }) {
    return `${STORAGE_PREFIX}:${month}:${warehouse}`;
}

export function loadStocktake({ month, warehouse }) {
    const key = makeStocktakeKey({ month, warehouse });
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return {
                month,
                warehouse,
                status: "draft",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lines: {}, // { [productId]: { counted: number|null, note: string } }
            };
        }
        const parsed = JSON.parse(raw);
        return {
            month,
            warehouse,
            status: parsed.status || "draft",
            createdAt: parsed.createdAt || new Date().toISOString(),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
            lines: parsed.lines || {},
        };
    } catch (_e) {
        return {
            month,
            warehouse,
            status: "draft",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lines: {},
        };
    }
}

export function saveStocktake(doc) {
    const key = makeStocktakeKey({ month: doc.month, warehouse: doc.warehouse });
    const toSave = {
        ...doc,
        updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(toSave));
    return toSave;
}

export function setLine({ doc, productId, counted, note }) {
    const pid = String(productId);
    const prev = doc.lines?.[pid] || {};
    const next = {
        ...doc,
        lines: {
            ...(doc.lines || {}),
            [pid]: {
                counted:
                    counted === "" || counted === null || counted === undefined
                        ? null
                        : Number(counted),
                note: note ?? prev.note ?? "",
            },
        },
    };
    return saveStocktake(next);
}

export function lockStocktake(doc) {
    return saveStocktake({ ...doc, status: "locked" });
}

export function unlockStocktake(doc) {
    return saveStocktake({ ...doc, status: "draft" });
}

export function listStocktakes() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${STORAGE_PREFIX}:`)) keys.push(k);
    }
    return keys
        .map((k) => {
            try {
                const raw = localStorage.getItem(k);
                const doc = raw ? JSON.parse(raw) : null;
                if (!doc) return null;
                const [, , month, warehouse] = k.split(":"); // stocktake:v1:YYYY-MM:WarehouseName(with colons? unlikely)
                return {
                    key: k,
                    month: doc.month || month,
                    warehouse: doc.warehouse || warehouse,
                    status: doc.status || "draft",
                    updatedAt: doc.updatedAt || doc.createdAt || "",
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function defaultMonth() {
    return ymKey(new Date());
}

