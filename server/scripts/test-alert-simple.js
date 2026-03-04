import { sendTelegramAlert, getAlertConfig, getVietnamTime } from './services/alerting.js';

async function test() {
    console.log('🧪 Testing Telegram Alert...\n');
    
    const config = getAlertConfig();
    console.log('📋 Configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log('\n');
    
    if (!config.telegram.configured) {
        console.error('❌ Telegram not configured!');
        console.log('Please check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
        process.exit(1);
    }
    
    console.log('📢 Sending test alert...');
    const result = await sendTelegramAlert(
        '🧪 Test alert từ server\n\nHệ thống cảnh báo đang hoạt động bình thường!',
        'info'
    );
    
    if (result) {
        console.log('✅ Thông báo đã được gửi thành công!');
        console.log('📱 Hãy kiểm tra Telegram của bạn.');
    } else {
        console.log('❌ Gửi thông báo thất bại. Vui lòng kiểm tra cấu hình.');
    }
}

test().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
