# 🚀 KẾ HOẠCH CẢI TIẾN - ONHAND STOCK V1

> **Last Updated:** 2026-01-26  
> **Version:** 1.0.0  
> **Status:** In Progress

---

## 📋 TỔNG QUAN

| Phase | Thời gian | Độ ưu tiên | Trạng thái |
|-------|-----------|------------|------------|
| Phase 1: Quick Wins | 1-2 tuần | 🔴 Cao | ✅ Hoàn thành |
| Phase 2: Architecture | 2-4 tuần | 🟠 Trung bình | ✅ Hoàn thành |
| Phase 3: Advanced Features | 4-8 tuần | 🟡 Thấp | ✅ Hoàn thành |
| Phase 4: Production Ready | Liên tục | 🟢 Bảo trì | ✅ Hoàn thành |

---

## 🏃 PHASE 1: QUICK WINS (1-2 tuần)

### 1.1 Performance Cơ bản

- [x] **Debounce Search Input** ✅
  - File: `src/components/Header.js`
  - Delay: 300ms sau khi user ngừng gõ
  - Giảm số lần re-render không cần thiết

- [x] **Skeleton Loaders** ✅
  - File: `src/store/dataStore.js`
  - Hiển thị 6 skeleton cards khi đang load
  - Cải thiện perceived performance

- [x] **Loading State Indicator** ✅
  - File: `src/components/Header.js`
  - Disable nút "Tải dữ liệu" khi đang load
  - Hiển thị spinner trên nút

### 1.2 User Experience

- [x] **Keyboard Shortcuts** ✅
  - `Ctrl+K`: Focus vào search
  - `Ctrl+R`: Reload data
  - `Ctrl+E`: Export Excel
  - `1-6`: Chuyển warehouse nhanh
  - `Escape`: Clear search
  - File: `src/App.js`

- [x] **Toast Notifications** ✅
  - Thông báo load thành công/thất bại
  - Auto-dismiss sau 3 giây
  - File: `src/store/dataStore.js`

- [x] **Remember Last Tab** ✅
  - Lưu tab đang active vào localStorage
  - Restore khi reload trang
  - File: `src/App.js`

### 1.3 Backend Optimization

- [x] **Response Compression** ✅
  - Package: `compression`
  - File: `server/index.js`
  - Giảm payload size ~70%

- [x] **Request Logging** ✅
  - Package: `morgan`
  - Log format: combined
  - File: `server/index.js`

---

## 🏗️ PHASE 2: ARCHITECTURE (2-4 tuần)

### 2.1 State Management

- [ ] **Migrate to Signals** (Optional - Low Priority)
  - Package: `@preact/signals-core`
  - Reactive state management
  - Files: 
    - `src/store/signals.js` (new)
    - `src/store/dataStore.js` (refactor)

- [x] **Create API Service Layer** ✅
  - Tách API calls ra khỏi dataStore
  - File: `src/services/api.js` (new)
  - Methods: `fetchStock()`, `fetchIncoming()`, `fetchFabricProducts()`
  - Features: Caching, retry logic, graceful degradation

- [ ] **Modular Store Architecture** (Optional)
  - Split store thành modules
  - Files:
    - `src/store/modules/warehouse.js`
    - `src/store/modules/filter.js`
    - `src/store/modules/ui.js`

### 2.2 Error Handling

- [x] **Retry Logic với Exponential Backoff** ✅
  - Max retries: 3
  - Delays: 1s, 2s, 4s (with jitter)
  - File: `src/utils/retry.js` (new)

- [ ] **Circuit Breaker Pattern** (Optional - Future)
  - Threshold: 5 failures
  - Timeout: 60 seconds
  - File: `src/utils/circuitBreaker.js` (new)

- [x] **Graceful Degradation** ✅
  - Cache last successful data
  - Show stale data when API fails
  - File: `src/services/api.js`

### 2.3 Caching

- [ ] **Backend Redis Cache** (Optional - High Traffic)
  - Package: `redis`
  - TTL: 5 minutes
  - File: `server/index.js`

- [x] **Frontend Memory Cache** ✅
  - Cache per API endpoint (stock, incoming, fabric)
  - TTL: 5 minutes
  - Auto-invalidate on manual refresh (Ctrl+R)
  - Graceful stale-data fallback
  - File: `src/services/api.js`

### 2.4 Performance

- [ ] **Virtual Scrolling** (Future - Large Lists)
  - Package: Vanilla implementation
  - Render only visible items
  - File: `src/components/VirtualList.js` (new)

- [ ] **Lazy Load Tabs** (Partially Done)
  - Fetch data only when tab is clicked
  - Cache fetched data
  - File: `src/store/dataStore.js`

---

## ⚡ PHASE 3: ADVANCED FEATURES (4-8 tuần)

### 3.1 Real-time Updates

- [ ] **WebSocket Server** (Future - Real-time)
  - Package: `ws`
  - Port: 4002
  - File: `server/websocket.js` (new)

- [ ] **WebSocket Client** (Future)
  - Auto-reconnect on disconnect
  - File: `src/services/websocket.js` (new)

- [ ] **Live Stock Updates** (Future)
  - Broadcast changes to all clients
  - Visual indicator for updated items

### 3.2 PWA Support

- [x] **Service Worker** ✅
  - Cache static assets
  - Offline support (network-first for API)
  - Auto-update detection
  - File: `public/sw.js` (new)

- [x] **Web App Manifest** ✅
  - App icon & name
  - Standalone display mode
  - Shortcuts for quick actions
  - File: `public/manifest.json` (new)

- [x] **Install Prompt** ✅
  - "Add to Home Screen" prompt
  - Auto-hide after 10 seconds
  - File: `index.html`

### 3.3 Advanced Export

- [x] **Excel Export với ExcelJS** ✅
  - Package: `exceljs`
  - Styled headers (brown theme)
  - Multiple sheets per warehouse
  - Summary sheet with totals
  - Stock status highlighting (low/out of stock)
  - Auto-filter enabled
  - File: `src/utils/export.js` (new)

- [x] **PDF Export** ✅
  - Package: `jspdf` + `html2canvas`
  - Full Vietnamese Unicode support
  - Company header with Bonario branding
  - Print-friendly landscape layout
  - Auto-pagination
  - File: `src/utils/export.js`

### 3.4 Advanced Filtering

- [ ] **Query Builder UI**
  - Multiple conditions
  - AND/OR logic
  - File: `src/components/QueryBuilder.js` (new)

- [ ] **Save Filter Presets**
  - Save to localStorage
  - Quick apply saved filters
  - File: `src/store/modules/filter.js`

- [ ] **Filter by Quantity Range**
  - Min/Max inputs
  - Slider component
  - File: `src/components/RangeFilter.js` (new)

---

## 🔒 PHASE 4: PRODUCTION READY (Liên tục)

### 4.1 Security

- [x] **Rate Limiting** ✅
  - Package: `express-rate-limit`
  - 100 requests / 15 minutes per IP
  - Returns retry-after headers
  - File: `server/index.js`

- [x] **Helmet Security Headers** ✅
  - Package: `helmet`
  - XSS protection, HSTS, etc.
  - File: `server/index.js`

- [ ] **API Request Signing** (Future - High Security)
  - HMAC signature
  - Verify on backend
  - Files: `server/middleware/auth.js` (new)

- [x] **Input Validation** ✅
  - Package: `zod`
  - Request sanitization middleware
  - XSS protection
  - File: `server/middleware/validate.js` (new)

### 4.2 Monitoring

- [ ] **Error Tracking (Sentry)** (Future)
  - Package: `@sentry/browser`
  - Auto-capture errors
  - File: `src/utils/sentry.js` (new)

- [ ] **Performance Monitoring** (Future)
  - Track page load time
  - Track API response time
  - File: `src/utils/analytics.js` (new)

- [x] **Health Check Endpoint** ✅
  - Status: Enhanced
  - Added: uptime, memory usage (heapUsed, heapTotal, rss)
  - Added: Node version, platform info
  - File: `server/index.js`

### 4.3 Testing

- [ ] **Unit Tests** (Future)
  - Package: `vitest`
  - Coverage: >80%
  - Files: `tests/unit/` (new folder)

- [ ] **Integration Tests**
  - API endpoint tests
  - Files: `tests/integration/` (new folder)

- [ ] **E2E Tests**
  - Package: `playwright`
  - Critical user flows
  - Files: `tests/e2e/` (new folder)

### 4.4 DevOps

- [x] **Docker Setup** ✅
  - Multi-stage Dockerfile for frontend (Vite build + Nginx)
  - Dockerfile for backend (Node.js Express)
  - docker-compose.yml with health checks
  - nginx.conf with caching & security headers
  - .dockerignore for optimized builds

- [x] **CI/CD Pipeline** ✅
  - GitHub Actions workflow
  - Lint → Build → Docker → Deploy stages
  - Auto-deploy on merge to main
  - Docker image build & push
  - File: `.github/workflows/ci-cd.yml`

- [x] **Environment Management** ✅
  - .env.example - Template with documentation
  - .env.staging - Staging configuration
  - .env.production - Production configuration
  - Files: `server/.env.*`

---

## 📊 METRICS & GOALS

### Performance Targets

| Metric | Current | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| First Load | ~2.5s | <2s | <1.5s | <1s |
| API Response | ~1.5s | <1.2s | <0.8s (cached) | <0.5s |
| Search Response | ~500ms | <200ms | <100ms | <50ms |
| Bundle Size | ~150KB | <140KB | <120KB | <100KB |

### UX Targets

| Metric | Current | Goal |
|--------|---------|------|
| Lighthouse Performance | 75 | >90 |
| Lighthouse Accessibility | 80 | >95 |
| Lighthouse Best Practices | 85 | >95 |
| Lighthouse SEO | 70 | >90 |

---

## 🗓️ TIMELINE

```
Week 1-2:   Phase 1 (Quick Wins)
            ├── Debounce search
            ├── Skeleton loaders
            ├── Keyboard shortcuts
            └── Backend compression

Week 3-4:   Phase 2 Part 1 (State Management)
            ├── Signals migration
            ├── API service layer
            └── Error handling

Week 5-6:   Phase 2 Part 2 (Caching & Performance)
            ├── Redis cache
            ├── Virtual scrolling
            └── Lazy load tabs

Week 7-8:   Phase 3 Part 1 (Real-time & PWA)
            ├── WebSocket setup
            ├── Service worker
            └── Manifest

Week 9-10:  Phase 3 Part 2 (Advanced Features)
            ├── Excel export
            ├── Query builder
            └── Filter presets

Ongoing:    Phase 4 (Production Ready)
            ├── Security hardening
            ├── Monitoring
            ├── Testing
            └── DevOps
```

---

## 📝 NOTES

### Dependencies to Add

```json
{
  "dependencies": {
    "@preact/signals-core": "^1.5.0",
    "exceljs": "^4.4.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.0"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "playwright": "^1.40.0"
  }
}
```

### Backend Dependencies

```json
{
  "dependencies": {
    "compression": "^1.7.4",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "morgan": "^1.10.0",
    "redis": "^4.6.12",
    "ws": "^8.16.0"
  }
}
```

---

## ✅ COMPLETED ITEMS

- [x] Merge ORDAP locations (157, 261)
- [x] Merge ORDHL locations (20, 269)
- [x] Merge ORDHY locations (219, 277)
- [x] Merge ORDST locations (195, 285)
- [x] Merge Kho Vải locations (217, 324, 184, 325)
- [x] Configure incoming locations (8, 244)
- [x] Fix F-SF filter (startsWith → includes)
- [x] Remove zero-stock fabric products display
- [x] Convert Chinese text to Vietnamese
- [x] Reorganize folder structure

---

## 🔗 REFERENCES

- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Preact Signals](https://preactjs.com/guide/v10/signals/)
- [ExcelJS](https://github.com/exceljs/exceljs)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

> 💡 **Tip:** Đánh dấu ✅ khi hoàn thành mỗi item. Commit với message format: `[Phase X] Item name`
