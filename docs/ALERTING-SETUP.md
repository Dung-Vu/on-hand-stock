# Hướng dẫn thiết lập hệ thống cảnh báo tự động

Hệ thống này sẽ tự động gửi thông báo đến điện thoại của bạn qua Telegram khi web có vấn đề.

## Tính năng

- ✅ Giám sát health check tự động (mỗi 60 giây)
- ✅ Phát hiện khi service down và gửi cảnh báo
- ✅ Thông báo khi service recovery
- ✅ Cảnh báo khi memory usage cao
- ✅ Cảnh báo khi có lỗi API
- ✅ Gửi thông báo qua Telegram Bot (miễn phí)

## Cách thiết lập Telegram Bot

### Bước 1: Tạo Telegram Bot

1. Mở Telegram và tìm kiếm `@BotFather`
2. Gửi lệnh `/newbot`
3. Đặt tên cho bot (ví dụ: "Bonario Alert Bot")
4. Đặt username cho bot (phải kết thúc bằng `bot`, ví dụ: `bonario_alert_bot`)
5. BotFather sẽ trả về **Bot Token** - hãy lưu lại token này

### Bước 2: Lấy Chat ID

Có 2 cách để lấy Chat ID:

#### Cách 1: Sử dụng @userinfobot
1. Tìm kiếm `@userinfobot` trên Telegram
2. Gửi lệnh `/start`
3. Bot sẽ trả về Chat ID của bạn (số có dấu `-` ở đầu nếu là group)

#### Cách 2: Sử dụng API
1. Gửi một tin nhắn bất kỳ cho bot bạn vừa tạo
2. Mở trình duyệt và truy cập:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   (Thay `<YOUR_BOT_TOKEN>` bằng token bạn nhận được từ BotFather)
3. Tìm `"chat":{"id":123456789}` - số `123456789` chính là Chat ID của bạn

### Bước 3: Cấu hình biến môi trường

Thêm các biến sau vào file `.env` trong thư mục `server/`:

```env
# Telegram Alerting
TELEGRAM_ALERT_ENABLED=true
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# Monitoring Configuration
MONITORING_ENABLED=true
MONITORING_INTERVAL=60000          # 60 giây (milliseconds)
MONITORING_TIMEOUT=5000            # 5 giây timeout
HEALTH_CHECK_URL=http://localhost:4001/api/health
MEMORY_THRESHOLD=500               # Cảnh báo khi memory > 500 MB
CONSECUTIVE_FAILURES=3             # Cảnh báo sau 3 lần fail liên tiếp
```

### Bước 4: Khởi động lại server

```bash
cd server
npm start
```

Hoặc nếu dùng Docker:

```bash
docker-compose restart backend
```

## Kiểm tra hoạt động

### 1. Kiểm tra cấu hình

Truy cập: `http://localhost:4001/api/health`

Trong response, kiểm tra phần `monitoring` và `alerting`:

```json
{
  "monitoring": {
    "enabled": true,
    "isMonitoring": true,
    "lastKnownStatus": "up"
  },
  "alerting": {
    "telegram": {
      "enabled": true,
      "configured": true
    }
  }
}
```

### 2. Test gửi thông báo

Bạn có thể test bằng cách tạm thời dừng server hoặc thay đổi `HEALTH_CHECK_URL` thành một URL không tồn tại.

## Các loại cảnh báo

### 🚨 Service Down
Gửi khi service không phản hồi sau 3 lần kiểm tra liên tiếp.

### ✅ Service Recovered
Gửi khi service phục hồi sau khi down, kèm thông tin thời gian downtime.

### ⚠️ High Memory Usage
Gửi khi memory usage vượt quá ngưỡng (mặc định 500 MB).

### ❌ API Error
Gửi khi có lỗi xảy ra trong các API endpoint.

## Tùy chỉnh

### Thay đổi khoảng thời gian kiểm tra

```env
MONITORING_INTERVAL=30000  # 30 giây
```

### Thay đổi ngưỡng memory

```env
MEMORY_THRESHOLD=1000  # 1 GB
```

### Thay đổi số lần fail trước khi cảnh báo

```env
CONSECUTIVE_FAILURES=5  # Cảnh báo sau 5 lần fail
```

### Tắt monitoring

```env
MONITORING_ENABLED=false
```

### Tắt Telegram alerting

```env
TELEGRAM_ALERT_ENABLED=false
```

## Troubleshooting

### Không nhận được thông báo

1. Kiểm tra Bot Token và Chat ID đã đúng chưa
2. Đảm bảo đã gửi ít nhất 1 tin nhắn cho bot
3. Kiểm tra logs của server để xem có lỗi gì không
4. Thử gửi thủ công bằng cách truy cập:
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Test
   ```

### Bot không phản hồi

- Đảm bảo bot đã được start (gửi `/start` cho bot)
- Kiểm tra Bot Token có đúng không

## Lưu ý

- Hệ thống sẽ tự động giảm tần suất cảnh báo (cooldown 5 phút) để tránh spam
- Monitoring chạy trong cùng process với server, nên nếu server crash hoàn toàn thì sẽ không gửi được cảnh báo
- Để giám sát từ bên ngoài, có thể sử dụng các dịch vụ như UptimeRobot, Pingdom kết hợp với Telegram alerts

## Mở rộng

Có thể mở rộng thêm:
- Email alerts (cần cấu hình SMTP)
- SMS alerts (qua Twilio, AWS SNS)
- Discord/Slack webhooks
- Push notifications
