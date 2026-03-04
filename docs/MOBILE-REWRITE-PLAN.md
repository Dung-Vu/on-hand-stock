# 📱 Kế hoạch viết lại mobile (React Native) - Android

Ngày cập nhật: 2026-02-05

## 1) Mục tiêu
- Ra mắt app Android với trải nghiệm native.
- Tái sử dụng tối đa logic dữ liệu, chỉ viết lại UI.
- Bảo đảm hoạt động ổn định với dữ liệu tồn kho, lọc, tìm kiếm, export, và realtime.

## 2) Phạm vi chức năng (MVP)
- Đăng nhập/thiết lập cấu hình kết nối (nếu cần).
- Dashboard thống kê (tổng kho, tổng sản phẩm, tổng số lượng).
- Danh sách tồn kho theo kho → danh mục.
- Tìm kiếm theo tên sản phẩm / số lô.
- Lọc theo kho và danh mục.
- Đồng bộ dữ liệu realtime (WebSocket) hoặc polling.
- Xuất CSV (chia sẻ hoặc lưu file).
- Hỗ trợ offline đọc dữ liệu gần nhất.

## 3) Kiến trúc đề xuất
- UI: React Native + React Navigation.
- State: Zustand hoặc Redux Toolkit.
- Networking: Axios + retry/circuit breaker.
- Storage: SQLite (ưu tiên) hoặc AsyncStorage.
- Realtime: WebSocket client.
- Error tracking: Sentry.

## 4) Mapping từ web sang mobile
- UI Components:
  - `src/components/Header.js` → `mobile/src/components/Header.tsx`
  - `src/components/Controls.js` → `mobile/src/components/Controls.tsx`
  - `src/components/StockData.js` → `mobile/src/components/StockData.tsx`
  - `src/components/Tabs.js` → `mobile/src/components/Tabs.tsx`
- Data/Store:
  - `src/store/dataStore.js` → `mobile/src/store/dataStore.ts`
  - `src/store/modules/*` → `mobile/src/store/modules/*`
- Services:
  - `src/services/api.js` → `mobile/src/services/api.ts`
  - `src/services/websocket.js` → `mobile/src/services/websocket.ts`
- Utils:
  - `src/utils/*` → `mobile/src/utils/*`
- Config:
  - `src/config.js` → `mobile/src/config.ts`

## 5) Lộ trình triển khai (8–10 tuần)

### Giai đoạn 0: Chuẩn bị (1 tuần)
- Chốt phạm vi MVP.
- Chốt thiết kế luồng màn hình.
- Định nghĩa model dữ liệu & hợp đồng API.

### Giai đoạn 1: Nền tảng (1–2 tuần)
- Khởi tạo dự án React Native.
- Cấu hình navigation, state, env, logging.
- Tạo service layer: api, websocket, retry.

### Giai đoạn 2: Core UI & Data (2–3 tuần)
- Xây các màn hình: Dashboard, Stock list, Stock detail.
- Tìm kiếm, lọc, nhóm dữ liệu.
- Kết nối API, cache dữ liệu local.

### Giai đoạn 3: Realtime & Offline (1–2 tuần)
- WebSocket cập nhật realtime.
- Offline read + sync lại khi online.

### Giai đoạn 4: Export & Hardening (1–2 tuần)
- Xuất CSV (share sheet).
- Cải thiện UX, loading, empty state.
- Error handling, monitoring.

### Giai đoạn 5: QA & Release (1 tuần)
- Unit + integration tests.
- Internal testing trên Play Console.
- Chuẩn bị store listing.

## 6) Backlog theo module
- **Auth/Config**: cấu hình kết nối, lưu token/API key.
- **Inventory**: list, group by warehouse/category.
- **Search/Filter**: realtime search, filter chips.
- **Stats**: tổng hợp kho/sản phẩm/số lượng.
- **Export**: CSV + share.
- **Realtime**: websocket + retry.
- **Offline**: local DB + sync.

## 7) Rủi ro & giảm thiểu
- **Android signing/keystore** → quản lý keystore an toàn, backup.
- **Realtime & cache** → dùng queue + debounce.
- **Dữ liệu lớn** → pagination + list virtualization.

## 8) Tiêu chí hoàn tất MVP
- 100% luồng chính hoạt động.
- Dữ liệu load < 3s với dataset trung bình.
- Không crash trong 1 tuần test nội bộ.

## 9) Deliverables
- Source code mobile (Android).
- Tài liệu build & release.
- AAB/APK release build.

## 10) Hướng dẫn triển khai Android (Windows OK)
1. Cài Android Studio + Android SDK + emulator.
2. Cài JDK (17+). Thiết lập `JAVA_HOME`.
3. Cài React Native CLI và tạo dự án.
4. Cấu hình `android/` (package name, icons, permissions).
5. Build debug: `npx react-native run-android`.
6. Build release (AAB): cấu hình keystore rồi chạy Gradle bundle.
7. Upload lên Play Console (Internal testing).

## 11) Checklist triển khai Android (chi tiết)

### A. Chuẩn bị môi trường
- [ ] Cài Android Studio (SDK Manager, Emulator).
- [ ] Cài JDK 17+ và set `JAVA_HOME`.
- [ ] Cài Node.js LTS + npm.
- [ ] Cài React Native CLI (hoặc dùng npx).
- [ ] Tạo thiết bị ảo (AVD) hoặc bật USB debugging trên máy thật.

### B. Khởi tạo & cấu hình dự án
- [ ] Tạo dự án React Native mới.
- [ ] Đặt `applicationId` (package name) chuẩn theo domain.
- [ ] Đặt `versionCode` và `versionName`.
- [ ] Thêm icon, splash, theme cơ bản.
- [ ] Cấu hình permissions cần thiết (network, storage nếu export file).

### C. Kết nối API & cấu hình môi trường
- [ ] Tạo file cấu hình môi trường (dev/staging/prod).
- [ ] Kiểm tra base URL từ thiết bị Android truy cập được backend.
- [ ] Thiết lập retry, timeout, logging.
- [ ] Kiểm tra WebSocket (reconnect, heartbeat).

### D. Lưu trữ offline
- [ ] Chọn SQLite/AsyncStorage.
- [ ] Mapping schema dữ liệu tồn kho.
- [ ] Cơ chế cache + đồng bộ khi online.

### E. UI/UX
- [ ] Màn Dashboard (stats).
- [ ] Màn Danh sách tồn kho (group by kho/danh mục).
- [ ] Tìm kiếm & filter.
- [ ] Màn chi tiết sản phẩm.
- [ ] Trạng thái loading/empty/error.

### F. Build debug
- [ ] Chạy `run-android` và test trên emulator.
- [ ] Test trên máy thật (USB + adb).
- [ ] Kiểm tra performance khi dữ liệu lớn.

### G. Signing & build release
- [ ] Tạo keystore (backup an toàn).
- [ ] Cấu hình signing trong `android/app/build.gradle`.
- [ ] Tạo `gradle.properties` để lưu keystore ref.
- [ ] Build AAB release thành công.
- [ ] Kiểm tra AAB bằng Bundletool (optional).

### H. Play Console
- [ ] Tạo ứng dụng mới trên Play Console.
- [ ] Upload AAB lên Internal testing.
- [ ] Tạo tester list và gửi link.
- [ ] Chuẩn bị store listing (icon, screenshot, mô tả).

### I. QA trước khi phát hành
- [ ] Smoke test full flow.
- [ ] Test offline/online.
- [ ] Test websocket reconnect.
- [ ] Kiểm tra export CSV (file/share).

### J. Release
- [ ] Tăng `versionCode`.
- [ ] Upload bản mới lên Internal/Closed testing.
- [ ] Publish Production khi đạt chất lượng.
