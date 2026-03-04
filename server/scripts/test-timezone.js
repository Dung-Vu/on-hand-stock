// Test timezone conversion
function getVietnamTime() {
    const now = new Date();
    
    // Vietnam timezone is UTC+7 (7 hours ahead of UTC)
    const vietnamOffset = 7 * 60; // 7 hours in minutes
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const vietnamTime = new Date(utc + (vietnamOffset * 60000));
    
    // Format: HH:mm:ss DD/MM/YYYY
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const year = vietnamTime.getFullYear();
    const hours = String(vietnamTime.getHours()).padStart(2, '0');
    const minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
    const seconds = String(vietnamTime.getSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

// Test
const now = new Date();
console.log('Current UTC time:', now.toISOString());
console.log('Current local time:', now.toString());
console.log('Vietnam time (old method):', getVietnamTime());

// Better method using Intl
const vietnamTimeString = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

console.log('Vietnam time (Intl method):', vietnamTimeString);
