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

- [x] **Migrate to Signals** ✅
  - Package: `@preact/signals-core`
  - Reactive state management with computed values and effects
  - Auto-persist active warehouse to localStorage
  - Files: 
    - `src/store/signals.js` (new)
    - `src/store/dataStore.js` (refactor)

- [x] **Modular Store Architecture** ✅
  - Split store into logical modules
  - Warehouse configuration and mapping
  - Filter state with utilities
  - UI state and toast management
  - Files:
    - `src/store/modules/warehouse.js`
    - `src/store/modules/filter.js`
    - `src/store/modules/ui.js`

### 2.2 Error Handling

- [x] **Circuit Breaker Pattern** ✅
  - Threshold: 5 failures before opening
  - Timeout: 60 seconds reset window
  - Volume threshold: 10 requests minimum
  - Three states: CLOSED, OPEN, HALF_OPEN
  - Integrated with API service layer
  - Fallback to stale cache on circuit open
  - Real-time statistics tracking
  - Files: 
    - `src/utils/circuitBreaker.js` (new)
    - `src/services/api.js` (integrated)

### 2.3 Caching

- [ ] **Backend Redis Cache** (Optional - High Traffic)
  - Package: `redis`
  - TTL: 5 minutes
  - File: `server/index.js`

### 2.4 Performance

- [ ] **Lazy Load Tabs** (Partially Done)
  - Fetch data only when tab is clicked
  - Cache fetched data
  - File: `src/store/dataStore.js`

---

## ⚡ PHASE 3: ADVANCED FEATURES (4-8 tuần)

### 3.1 Real-time Updates

- [x] **WebSocket Server** ✅
  - Package: `ws`
  - Attached to HTTP server for simplicity
  - Client management with heartbeat
  - Subscription-based broadcasting
  - File: `server/websocket.js`

- [x] **WebSocket Client** ✅
  - Auto-reconnect with exponential backoff
  - Event-driven architecture
  - Heartbeat keepalive
  - Subscription management
  - File: `src/services/websocket.js`

- [x] **Live Stock Updates** ✅
  - Real-time stock update handling
  - Batch updates support
  - Toast notifications for updates
  - File: `src/store/dataStore.js`

- [x] **Visual Indicator for Updated Items** ✅
  - Flash animation on update
  - Color-coded badges (green↑/red↓)
  - Auto-fade after 3 seconds
  - File: `src/store/dataStore.js`

### 3.4 Monitoring

- [x] **Error Tracking (Sentry)** ✅
  - Package: `@sentry/browser`
  - Auto-capture errors with context
  - Breadcrumbs for API calls & navigation
  - Global error handlers
  - File: `src/utils/sentry.js`

- [x] **Performance Monitoring** ✅
  - Track page load time & Core Web Vitals (LCP, FID, CLS, TTFB)
  - Track API response time with percentiles
  - Custom metrics & render time tracking
  - File: `src/utils/analytics.js`

### 3.3 Testing

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

- [x] **API Request Signing** ✅
  - HMAC-SHA256 signature verification
  - Timestamp validation (5-minute window)
  - Timing-safe comparison to prevent attacks
  - Optional mode for gradual rollout
  - Files: `server/middleware/auth.js`, `src/utils/hmac.js`

- [x] **Input Validation** ✅
  - Package: `zod`
  - Request sanitization middleware
  - XSS protection
  - File: `server/middleware/validate.js` (new)

### 4.2 Monitoring

- [x] **Error Tracking (Sentry)** ✅
  - Package: `@sentry/browser`
  - Auto-capture errors with context
  - Breadcrumbs for API calls & navigation
  - Global error handlers
  - File: `src/utils/sentry.js`

- [x] **Performance Monitoring** ✅
  - Track page load time & Core Web Vitals (LCP, FID, CLS, TTFB)
  - Track API response time with percentiles
  - Custom metrics & render time tracking
  - File: `src/utils/analytics.js`

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
