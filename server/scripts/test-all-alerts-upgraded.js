// ============================================
// TEST ALL ALERT TYPES (UPGRADED)
// Test tất cả 8 loại thông báo đã được nâng cấp
// ============================================

import { 
    sendTelegramAlert, 
    alertServiceDown, 
    alertServiceRecovered,
    alertHighMemory,
    alertApiError,
    getAlertConfig 
} from './services/alerting.js';

async function testAllUpgradedAlerts() {
    console.log('🧪 Testing All Upgraded Alert Types...\n');
    
    const config = getAlertConfig();
    console.log('📋 Configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log('\n');
    
    if (!config.telegram.configured) {
        console.error('❌ Telegram not configured!');
        console.log('Please check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
        process.exit(1);
    }
    
    console.log('📢 Bắt đầu gửi 8 loại thông báo...\n');
    
    // Test 1: Info Alert
    console.log('1️⃣  Testing Info Alert...');
    await sendTelegramAlert(
        'ℹ️ *THÔNG TIN HỆ THỐNG*\n\n' +
        'Hệ thống đang hoạt động bình thường.\n' +
        'Tất cả các service đều ổn định.',
        'info'
    );
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 2: Warning Alert
    console.log('2️⃣  Testing Warning Alert...');
    await sendTelegramAlert(
        '⚠️ *CẢNH BÁO*\n\n' +
        'Có một số vấn đề cần chú ý.\n' +
        'Vui lòng kiểm tra và xử lý.',
        'warning'
    );
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 3: Error Alert
    console.log('3️⃣  Testing Error Alert...');
    await sendTelegramAlert(
        '❌ *LỖI HỆ THỐNG*\n\n' +
        'Đã phát hiện lỗi trong hệ thống.\n' +
        'Cần xử lý ngay.',
        'error'
    );
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 4: Critical Alert
    console.log('4️⃣  Testing Critical Alert...');
    await sendTelegramAlert(
        '🚨 *CẢNH BÁO KHẨN CẤP*\n\n' +
        'Hệ thống gặp sự cố nghiêm trọng!\n' +
        'Cần can thiệp ngay lập tức.',
        'critical'
    );
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 5: Service Down Alert
    console.log('5️⃣  Testing Service Down Alert...');
    await alertServiceDown('Stock API Server', 'Connection timeout after 3 attempts');
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 6: Service Recovered Alert
    console.log('6️⃣  Testing Service Recovered Alert...');
    await alertServiceRecovered('Stock API Server', 180); // 3 phút downtime
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 7: High Memory Alert
    console.log('7️⃣  Testing High Memory Alert...');
    await alertHighMemory(750, 500); // 750 MB, threshold 500 MB
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 8: API Error Alert
    console.log('8️⃣  Testing API Error Alert...');
    await alertApiError('/api/stock', 'Database connection failed: Connection refused');
    
    console.log('\n✅ Tất cả 8 loại thông báo đã được gửi thành công!');
    console.log('📱 Hãy kiểm tra Telegram để xem các thông báo đã được nâng cấp.');
    console.log('\n📊 Tóm tắt:');
    console.log('   1. Info Alert - Thông tin hệ thống');
    console.log('   2. Warning Alert - Cảnh báo');
    console.log('   3. Error Alert - Lỗi hệ thống');
    console.log('   4. Critical Alert - Cảnh báo khẩn cấp');
    console.log('   5. Service Down - Service không phản hồi');
    console.log('   6. Service Recovered - Service đã phục hồi');
    console.log('   7. High Memory - Memory usage cao');
    console.log('   8. API Error - Lỗi API endpoint');
}

testAllUpgradedAlerts().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
