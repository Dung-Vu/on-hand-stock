// Test timezone in Docker
function getVietnamTime() {
    const now = new Date();
    
    // Sử dụng Intl.DateTimeFormat để chuyển đổi chính xác sang múi giờ Việt Nam
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const timeObj = {};
    parts.forEach(part => {
        timeObj[part.type] = part.value;
    });
    
    // Format: HH:mm:ss DD/MM/YYYY
    const hours = timeObj.hour.padStart(2, '0');
    const minutes = timeObj.minute.padStart(2, '0');
    const seconds = timeObj.second.padStart(2, '0');
    const day = timeObj.day.padStart(2, '0');
    const month = timeObj.month.padStart(2, '0');
    const year = timeObj.year;
    
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

const now = new Date();
console.log('UTC time:', now.toISOString());
console.log('Vietnam time:', getVietnamTime());
console.log('Current time in container:', now.toString());
