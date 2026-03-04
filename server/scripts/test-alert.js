// ============================================
// TEST ALERT SCRIPT
// Script để test hệ thống cảnh báo
// ============================================

import { config } from 'dotenv';
import { sendTelegramAlert, sendAlert, getAlertConfig } from '../services/alerting.js';

config();

async function testAlerts() {
    console.log('🧪 Testing Alert System...\n');

    // Check configuration
    const config = getAlertConfig();
    console.log('📋 Configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log('\n');

    if (!config.telegram.configured) {
        console.error('❌ Telegram not configured!');
        console.log('Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env file');
        process.exit(1);
    }

    // Test 1: Info alert
    console.log('📢 Test 1: Sending info alert...');
    const result1 = await sendTelegramAlert('Đây là thông báo test - Info level', 'info');
    console.log(result1 ? '✅ Sent successfully' : '❌ Failed to send');
    console.log('\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Warning alert
    console.log('⚠️  Test 2: Sending warning alert...');
    const result2 = await sendTelegramAlert('Đây là cảnh báo test - Warning level', 'warning');
    console.log(result2 ? '✅ Sent successfully' : '❌ Failed to send');
    console.log('\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Error alert
    console.log('❌ Test 3: Sending error alert...');
    const result3 = await sendTelegramAlert('Đây là lỗi test - Error level', 'error');
    console.log(result3 ? '✅ Sent successfully' : '❌ Failed to send');
    console.log('\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Critical alert
    console.log('🚨 Test 4: Sending critical alert...');
    const result4 = await sendTelegramAlert('Đây là cảnh báo khẩn cấp test - Critical level', 'critical');
    console.log(result4 ? '✅ Sent successfully' : '❌ Failed to send');
    console.log('\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log(`Info: ${result1 ? '✅' : '❌'}`);
    console.log(`Warning: ${result2 ? '✅' : '❌'}`);
    console.log(`Error: ${result3 ? '✅' : '❌'}`);
    console.log(`Critical: ${result4 ? '✅' : '❌'}`);

    if (result1 && result2 && result3 && result4) {
        console.log('\n🎉 All tests passed! Check your Telegram for messages.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check your configuration.');
    }
}

testAlerts().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
