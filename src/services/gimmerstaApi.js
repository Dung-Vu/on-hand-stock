// Server-side proxy only: supplier credentials never leave the backend.
// Keep the same API origin policy as the existing ARTE stock lookup.
function apiBase() {
  if (window.API_BASE_URL) return window.API_BASE_URL;
  const { hostname, protocol, port } = window.location;
  if (hostname.includes('bonstu.site')) return '';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:4001';
  if (/^517\d$/.test(port)) return `${protocol}//${hostname}:4001`;
  return '';
}

const messages = {
  INVALID_INPUT: 'Nhập mã sản phẩm hoặc link chi tiết Gimmersta hợp lệ.',
  PRODUCT_NOT_FOUND: 'Không tìm thấy đúng mã sản phẩm trên Gimmersta.',
  AUTHENTICATION_FAILED: 'Không thể đăng nhập Gimmersta. Vui lòng liên hệ quản trị viên.',
  CONFIG_MISSING: 'Chưa cấu hình tài khoản Gimmersta trên máy chủ.',
  UPSTREAM_UNCLASSIFIED:
    'Không đọc được trạng thái tồn từ Gimmersta. Vui lòng xem trực tiếp website.',
  RATE_LIMITED: 'Tra cứu quá nhiều lần. Vui lòng thử lại sau một phút.',
  QUEUE_FULL: 'Hệ thống tra cứu đang bận. Vui lòng thử lại sau.',
  QUEUE_TIMEOUT: 'Yêu cầu chờ quá lâu. Vui lòng thử lại sau.',
  UPSTREAM_NETWORK_ERROR: 'Không kết nối được tới Gimmersta. Vui lòng thử lại sau.',
};

export async function fetchGimmerstaStock(product) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000);
  try {
    const response = await fetch(
      `${apiBase()}/api/gimmersta/stock?product=${encodeURIComponent(product.trim())}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(
        messages[payload?.code] || 'Không thể tra cứu Gimmersta lúc này. Vui lòng thử lại sau.'
      );
    }
    return payload.data;
  } catch (err) {
    if (err.name === 'AbortError')
      throw new Error('Gimmersta phản hồi quá lâu. Vui lòng thử lại sau.');
    if (err instanceof TypeError) throw new Error('Không kết nối được máy chủ tra cứu.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
