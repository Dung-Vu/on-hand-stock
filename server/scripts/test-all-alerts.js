import { 
    sendTelegramAlert, 
    alertServiceDown, 
    alertServiceRecovered,
    alertHighMemory,
    alertApiError 
} from './services/alerting.js';

async function testAll() {
    console.log('🧪 Testing All Alert Types...\n');
    
    // Test 1: Info
    console.log('1️⃣  Testing Info Alert...');
    await sendTelegramAlert('Thông báo thông thường - Info level', 'info');
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 2: Warning
    console.log('2️⃣  Testing Warning Alert...');
    await sendTelegramAlert('Cảnh báo - Warning level', 'warning');
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 3: Error
    console.log('3️⃣  Testing Error Alert...');
    await sendTelegramAlert('Lỗi - Error level', 'error');
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 4: Critical
    console.log('4️⃣  Testing Critical Alert...');
    await sendTelegramAlert('Cảnh báo khẩn cấp - Critical level', 'critical');
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 5: Service Down
    console.log('5️⃣  Testing Service Down Alert...');
    await alertServiceDown('Stock API', 'Connection timeout');
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 6: Service Recovered
    console.log('6️⃣  Testing Service Recovered Alert...');
    await alertServiceRecovered('Stock API', 120);
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 7: High Memory
    console.log('7️⃣  Testing High Memory Alert...');
    await alertHighMemory(750, 500);
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 8: API Error
    console.log('8️⃣  Testing API Error Alert...');
    await alertApiError('/api/stock', 'Database connection failed');
    
    console.log('\n✅ Tất cả các test đã hoàn thành!');
    console.log('📱 Hãy kiểm tra Telegram để xem các thông báo.');
}

testAll().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
