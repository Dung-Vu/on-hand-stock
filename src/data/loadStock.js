import {
  fetchDiscontinuedProducts,
  fetchIncoming,
  fetchStock,
  getCacheStats,
  markWarehouseLoaded,
} from '../services/api.js';
import {
  groupDataByWarehouseAndCategory,
  processIncomingData,
  processOdooData,
} from './stockPipeline.js';

function countProducts(groupedData) {
  return Object.values(groupedData || {}).reduce((warehouseTotal, warehouse) => {
    return (
      warehouseTotal +
      Object.values(warehouse.categories || {}).reduce((categoryTotal, category) => {
        return categoryTotal + Object.keys(category.products || {}).length;
      }, 0)
    );
  }, 0);
}

export async function loadGroupedStock({ forceRefresh = false } = {}) {
  const cacheStatsBefore = getCacheStats();
  const fromCache = !forceRefresh && cacheStatsBefore.validEntries > 0;
  const [onhandData, incomingData, discontinuedIds] = await Promise.all([
    fetchStock({ useCache: !forceRefresh, forceRefresh }),
    fetchIncoming({ useCache: !forceRefresh, forceRefresh }),
    fetchDiscontinuedProducts({ useCache: !forceRefresh, forceRefresh }),
  ]);

  if (!onhandData || onhandData.length === 0) {
    return { empty: true, groupedData: null, rows: [], fromCache, totalProducts: 0 };
  }

  const processedOnhand = processOdooData(onhandData);
  const rows = [...processedOnhand, ...processIncomingData(incomingData, processedOnhand)];
  const groupedData = groupDataByWarehouseAndCategory(rows, discontinuedIds);
  Object.keys(groupedData).forEach(warehouseName => markWarehouseLoaded(warehouseName));

  return {
    empty: false,
    groupedData,
    rows,
    fromCache,
    totalProducts: countProducts(groupedData),
  };
}
