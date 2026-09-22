import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';

/**
 * Custom error class for ARTE upstream operations.
 */
export class ArteError extends Error {
  constructor(message, code = 'UPSTREAM_ERROR', status = 503) {
    super(message);
    this.name = 'ArteError';
    this.code = code;
    this.status = status;
  }
}

function isRetryableSessionError(err) {
  return err?.status === 419
    || err?.code === 'SESSION_EXPIRED'
    || err?.code === 'UPSTREAM_NETWORK_ERROR'
    || err?.code === 'TIMEOUT';
}

/**
 * Conservative reference validator:
 * Trimmed string 1..40 chars consisting only of letters, digits, '.', '-', '_', '/', and spaces.
 */
export function validateReference(ref) {
  if (typeof ref !== 'string') return null;
  const trimmed = ref.trim();
  if (trimmed.length < 1 || trimmed.length > 40) return null;
  if (!/^[a-zA-Z0-9.\-_/ ]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Batch validator:
 * Conservative ARTE token characters (letters, digits, dot, dash, underscore, slash) and 1..60 chars.
 * Rejects control characters and whitespace.
 */
export function validateBatch(batch) {
  if (typeof batch !== 'string') return null;
  const trimmed = batch.trim();
  if (trimmed.length < 1 || trimmed.length > 60) return null;
  if (!/^[a-zA-Z0-9.\-_/]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Amount validator: finite number > 0 and <= 100,000.
 * Supports positive decimals (e.g. wallcovering roll amounts).
 */
export function validateAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0 || num > 100000) return null;
  return num;
}

/**
 * Image URL sanitization:
 * Only absolute https URLs on arte-international.com, www.arte-international.com,
 * or edge.arte-international.com are allowed. Otherwise omit (return undefined).
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return undefined;
    const allowedHosts = [
      'arte-international.com',
      'www.arte-international.com',
      'edge.arte-international.com',
    ];
    if (allowedHosts.includes(parsed.hostname.toLowerCase())) {
      return parsed.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Bounded in-memory cache with TTL and capacity limit.
 * Does not cache errors or sensitive data.
 */
export class BoundedCache {
  constructor(maxSize = 300, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, customTtlMs) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    const ttl = customTtlMs ?? this.ttlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * Lightweight concurrency queue to bound upstream calls.
 * Enforces maximum concurrency, maximum waiting queue size, and bounded queue wait timeout.
 */
export class ConcurrencyQueue {
  constructor(maxConcurrency = 2, maxQueueSize = 50, queueWaitTimeoutMs = 15000) {
    this.maxConcurrency = maxConcurrency;
    this.maxQueueSize = maxQueueSize;
    this.queueWaitTimeoutMs = queueWaitTimeoutMs;
    this.running = 0;
    this.queue = [];
  }

  run(fn, options = {}) {
    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(
        new ArteError(
          'Hàng đợi xử lý ARTE đã đầy, vui lòng thử lại sau giây lát',
          'QUEUE_FULL',
          429
        )
      );
    }

    const signal = options.signal;
    if (signal?.aborted) {
      return Promise.reject(
        new ArteError('Yêu cầu đã bị hủy', 'CLIENT_ABORTED', 499)
      );
    }

    return new Promise((resolve, reject) => {
      let waitTimer = null;
      let abortHandler = null;

      const item = {
        fn,
        resolve,
        reject,
        cancelled: false,
      };

      const cleanup = () => {
        if (waitTimer) {
          clearTimeout(waitTimer);
          waitTimer = null;
        }
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
          abortHandler = null;
        }
      };

      const effectiveTimeout = options.timeoutMs ?? this.queueWaitTimeoutMs;
      if (effectiveTimeout > 0 && Number.isFinite(effectiveTimeout)) {
        waitTimer = setTimeout(() => {
          item.cancelled = true;
          const idx = this.queue.indexOf(item);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
          cleanup();
          reject(
            new ArteError(
              'Yêu cầu ARTE chờ trong hàng đợi quá thời gian xử lý',
              'QUEUE_TIMEOUT',
              504
            )
          );
        }, effectiveTimeout);
      }

      if (signal) {
        abortHandler = () => {
          item.cancelled = true;
          const idx = this.queue.indexOf(item);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
          cleanup();
          reject(new ArteError('Yêu cầu đã bị hủy', 'CLIENT_ABORTED', 499));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      item.cleanup = cleanup;
      this.queue.push(item);
      this._process();
    });
  }

  _process() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    if (item.cancelled) {
      this._process();
      return;
    }

    // Clear wait timer and listeners before starting execution
    item.cleanup();
    this.running++;

    item.fn()
      .then(item.resolve, item.reject)
      .finally(() => {
        this.running--;
        this._process();
      });
  }
}

/**
 * HTTP helper with cookie management and redirect control.
 */
export async function fetchWithCookies(fetchFn, cookieJar, url, options = {}, maxRedirects = 5) {
  let currentUrl = url;
  let currentOptions = { ...options };

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const headers = new Headers(currentOptions.headers || {});
    const cookieString = await cookieJar.getCookieString(currentUrl);
    if (cookieString) {
      headers.set('Cookie', cookieString);
    }

    const controller = new AbortController();
    const timeoutMs = currentOptions.timeoutMs || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetchFn(currentUrl, {
        ...currentOptions,
        headers,
        signal: currentOptions.signal || controller.signal,
        redirect: 'manual',
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ArteError('Yêu cầu tới hệ thống ARTE đã quá thời gian phản hồi (timeout)', 'TIMEOUT', 504);
      }
      throw new ArteError('Không thể kết nối tới hệ thống ARTE', 'UPSTREAM_NETWORK_ERROR', 503);
    } finally {
      clearTimeout(timeoutId);
    }

    // Capture cookies
    let setCookies = [];
    if (typeof response.headers?.getSetCookie === 'function') {
      setCookies = response.headers.getSetCookie();
    } else if (response.headers?.get?.('set-cookie')) {
      setCookies = [response.headers.get('set-cookie')];
    }
    for (const cookieStr of setCookies) {
      if (cookieStr) {
        try {
          await cookieJar.setCookie(cookieStr, currentUrl);
        } catch {
          // ignore cookie parse error
        }
      }
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    const location = response.headers?.get?.('location');
    if (isRedirect && location && (options.followRedirects !== false)) {
      if (redirectCount >= maxRedirects) {
        throw new ArteError('Quá nhiều lượt chuyển hướng từ hệ thống ARTE', 'TOO_MANY_REDIRECTS', 502);
      }
      currentUrl = new URL(location, currentUrl).href;
      if (response.status === 303 || (response.status === 302 && currentOptions.method === 'POST')) {
        currentOptions = {
          ...currentOptions,
          method: 'GET',
          body: undefined,
        };
        delete currentOptions.headers['Content-Type'];
      }
      continue;
    }

    return response;
  }
}

export const STOCK_FORM_WIRE_NAME = 'app.front.features.professional-area.stock-check-form';

/**
 * Service to interact with ARTE International Professional Area stock check.
 */
export class ArteService {
  constructor(options = {}) {
    this.email = options.email ?? process.env.ARTE_EMAIL;
    this.password = options.password ?? process.env.ARTE_PASSWORD;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.cookieJar = options.cookieJar ?? new CookieJar();
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.queue = new ConcurrencyQueue(
      options.maxConcurrency ?? 2,
      options.maxQueueSize ?? 50,
      options.queueWaitTimeoutMs ?? 15000
    );
    this.loginMutex = null;

    // In-memory cache for normalized batches only (no mutable snapshots or tokens cached)
    this.batchesCache = new BoundedCache(300, 10 * 60 * 1000); // 10 minutes
    this.stockCheckCache = new BoundedCache(500, 2 * 60 * 1000); // 2 minutes

    this.stockPageUrl = options.stockPageUrl ?? 'https://www.arte-international.com/en/professional-area/check-our-stock';
    this.loginPageUrl = options.loginPageUrl ?? 'https://account.arte-international.com/en/login?service=front';
    this.loginPostUrl = options.loginPostUrl ?? 'https://account.arte-international.com/en/login';
  }

  isConfigured() {
    const email = this.email ?? process.env.ARTE_EMAIL;
    const password = this.password ?? process.env.ARTE_PASSWORD;
    return Boolean(email && password);
  }

  _getConfig() {
    const email = this.email ?? process.env.ARTE_EMAIL;
    const password = this.password ?? process.env.ARTE_PASSWORD;
    if (!email || !password) {
      throw new ArteError(
        'Hệ thống chưa được cấu hình tài khoản ARTE (ARTE_EMAIL/ARTE_PASSWORD)',
        'ARTE_CONFIG_MISSING',
        503
      );
    }
    return { email, password };
  }

  /**
   * Determine if HTML contains an active login form.
   * Does NOT classify HTML solely because it contains an account login URL or link.
   */
  _isLoginPage(html) {
    if (!html || typeof html !== 'string') return false;
    const $ = cheerio.load(html);
    const hasPasswordInput = $('input[type="password"], input[name="password"]').length > 0;
    const hasEmailOrUserInput = $('input[name="email"], input[type="email"], input[name="username"]').length > 0;
    const hasLoginForm = $('form[action*="/login"], form[action*="account.arte-international.com"]').length > 0;
    return hasPasswordInput && (hasEmailOrUserInput || hasLoginForm);
  }

  /**
   * Ensure user is authenticated, using a mutex to prevent login storms.
   */
  async _ensureAuthenticated(forceReauth = false) {
    if (this.loginMutex) {
      return this.loginMutex;
    }

    this.loginMutex = (async () => {
      try {
        if (!forceReauth) {
          // Verify existing session by checking protected stock page
          const checkRes = await fetchWithCookies(this.fetchFn, this.cookieJar, this.stockPageUrl, {
            method: 'GET',
            timeoutMs: this.timeoutMs,
            followRedirects: false,
          });

          const isRedirectToLogin = [301, 302, 303, 307, 308].includes(checkRes.status) &&
            checkRes.headers.get('location')?.includes('login');

          if (checkRes.status === 200 && !isRedirectToLogin) {
            const html = await checkRes.text();
            if (!this._isLoginPage(html)) {
              try {
                this._extractStockFormSnapshot(html);
                return; // Session is valid and stock form exists
              } catch {
                // Stock form missing, need login
              }
            }
          }
        }

        // Perform login
        await this._performLogin();
      } finally {
        this.loginMutex = null;
      }
    })();

    return this.loginMutex;
  }

  /**
   * Perform login to ARTE account:
   * 1. GET login page to obtain initial CSRF token.
   * 2. POST credentials with controlled redirects to capture session cookies.
   * 3. Explicitly GET protected stock page to verify login succeeded.
   */
  async _performLogin() {
    const { email, password } = this._getConfig();

    // Step 1: GET login page to obtain initial CSRF token
    const loginPageRes = await fetchWithCookies(this.fetchFn, this.cookieJar, this.loginPageUrl, {
      method: 'GET',
      timeoutMs: this.timeoutMs,
    });

    if (!loginPageRes.ok) {
      throw new ArteError('Không thể truy cập trang đăng nhập ARTE', 'UPSTREAM_LOGIN_UNAVAILABLE', 503);
    }

    const loginHtml = await loginPageRes.text();
    const $ = cheerio.load(loginHtml);
    const csrfToken = $('input[name="_token"]').val() || $('meta[name="csrf-token"]').attr('content');

    if (!csrfToken) {
      throw new ArteError('Không tìm thấy CSRF token trên trang đăng nhập ARTE', 'UPSTREAM_TOKEN_MISSING', 502);
    }

    // Step 2: POST credentials with redirects disabled to capture cookies at this hop
    const params = new URLSearchParams({
      _token: csrfToken,
      email,
      password,
      remember: '1',
    });

    const loginRes = await fetchWithCookies(this.fetchFn, this.cookieJar, this.loginPostUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: this.loginPageUrl,
      },
      body: params.toString(),
      timeoutMs: this.timeoutMs,
      followRedirects: false,
    });

    // If login returned 200 with login page (e.g. invalid credentials) or error status
    if (loginRes.status === 200) {
      const respHtml = await loginRes.text();
      if (this._isLoginPage(respHtml)) {
        throw new ArteError(
          'Đăng nhập ARTE không thành công. Vui lòng kiểm tra lại cấu hình tài khoản.',
          'AUTHENTICATION_FAILED',
          503
        );
      }
    } else if (loginRes.status >= 400) {
      throw new ArteError(
        'Đăng nhập ARTE không thành công. Vui lòng kiểm tra lại cấu hình tài khoản.',
        'AUTHENTICATION_FAILED',
        503
      );
    }

    // Step 3: Explicitly GET protected stock page to confirm authentication succeeded
    const stockPageRes = await fetchWithCookies(this.fetchFn, this.cookieJar, this.stockPageUrl, {
      method: 'GET',
      timeoutMs: this.timeoutMs,
      followRedirects: true,
    });

    if (!stockPageRes.ok) {
      throw new ArteError(
        'Đăng nhập ARTE không thành công. Vui lòng kiểm tra lại cấu hình tài khoản.',
        'AUTHENTICATION_FAILED',
        503
      );
    }

    const stockHtml = await stockPageRes.text();
    if (this._isLoginPage(stockHtml)) {
      throw new ArteError(
        'Đăng nhập ARTE không thành công. Vui lòng kiểm tra lại cấu hình tài khoản.',
        'AUTHENTICATION_FAILED',
        503
      );
    }

    try {
      this._extractStockFormSnapshot(stockHtml);
    } catch {
      throw new ArteError(
        'Đăng nhập ARTE không thành công. Vui lòng kiểm tra lại cấu hình tài khoản.',
        'AUTHENTICATION_FAILED',
        503
      );
    }
  }

  /**
   * Fetch initial stock page and discover Livewire update URI, CSRF token, and stock form component snapshot.
   */
  async _getInitialStockPageState() {
    await this._ensureAuthenticated();

    const pageRes = await fetchWithCookies(this.fetchFn, this.cookieJar, this.stockPageUrl, {
      method: 'GET',
      timeoutMs: this.timeoutMs,
      followRedirects: true,
    });

    const html = await pageRes.text();

    if (this._isLoginPage(html)) {
      // Session expired, reauth once
      await this._ensureAuthenticated(true);
      const retryRes = await fetchWithCookies(this.fetchFn, this.cookieJar, this.stockPageUrl, {
        method: 'GET',
        timeoutMs: this.timeoutMs,
        followRedirects: true,
      });
      const retryHtml = await retryRes.text();
      if (this._isLoginPage(retryHtml)) {
        throw new ArteError('Phiên đăng nhập ARTE hết hạn', 'SESSION_EXPIRED', 503);
      }
      return this._parseLivewireStateFromHtml(retryHtml);
    }

    return this._parseLivewireStateFromHtml(html);
  }

  /**
   * Select exact stock form component:
   * 1. By wire:name="app.front.features.professional-area.stock-check-form" first.
   * 2. Fallback to closest ancestor with wire:snapshot around input[name=code].
   * Never select arbitrary first page component.
   */
  _extractStockFormSnapshot(htmlOrCheerio) {
    const $ = typeof htmlOrCheerio === 'string' ? cheerio.load(htmlOrCheerio) : htmlOrCheerio;

    // 1. By wire:name first
    const compByName = $(`[wire\\:name="${STOCK_FORM_WIRE_NAME}"]`);
    if (compByName.length > 0) {
      let snapshot = compByName.attr('wire:snapshot');
      if (!snapshot) {
        snapshot = compByName.closest('[wire\\:snapshot]').attr('wire:snapshot') ||
          compByName.find('[wire\\:snapshot]').attr('wire:snapshot');
      }
      if (snapshot) return snapshot;
    }

    // 2. Fallback: closest ancestor with wire:snapshot around input[name=code]
    const codeInput = $('input[name="code"], input[wire\\:model="code"], input[wire\\:model\\.live="code"]').first();
    if (codeInput.length > 0) {
      const snap = codeInput.closest('[wire\\:snapshot]').attr('wire:snapshot');
      if (snap) return snap;
    }

    throw new ArteError(
      'Không tìm thấy Livewire snapshot cho form kiểm tra tồn kho trên trang ARTE',
      'UPSTREAM_SNAPSHOT_MISSING',
      502
    );
  }

  /**
   * Extract Livewire snapshot, token, and update URI from page HTML.
   * Fails closed with UPSTREAM_ENDPOINT_MISSING if script[data-update-uri] is missing or invalid.
   */
  _parseLivewireStateFromHtml(html) {
    const $ = cheerio.load(html);

    // Stock form component snapshot
    const snapshot = this._extractStockFormSnapshot($);

    // Livewire discovery from script[data-update-uri]
    let scriptEl = $('script[data-update-uri]').first();
    let rawUpdateUri = scriptEl.attr('data-update-uri');
    let token = scriptEl.attr('data-csrf');

    // Fallback config check for test fixtures or alternate layout
    if (!rawUpdateUri) {
      const configMatch = html.match(/livewireScriptConfig\s*=\s*({[\s\S]*?});/);
      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1]);
          if (config.uri) rawUpdateUri = config.uri;
          if (config.csrf && !token) token = config.csrf;
        } catch {
          // ignore parse error
        }
      }
    }

    if (!token) {
      token = $('meta[name="csrf-token"]').attr('content') ||
        $('input[name="_token"]').val();
    }

    if (!rawUpdateUri) {
      throw new ArteError(
        'Không tìm thấy endpoint Livewire hợp lệ trên trang ARTE',
        'UPSTREAM_ENDPOINT_MISSING',
        502
      );
    }

    // Validate update URI
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUpdateUri, this.stockPageUrl);
    } catch {
      throw new ArteError(
        'Endpoint Livewire không hợp lệ',
        'UPSTREAM_ENDPOINT_MISSING',
        502
      );
    }

    const allowedHosts = [
      'arte-international.com',
      'www.arte-international.com',
    ];
    if (parsedUrl.protocol !== 'https:' || !allowedHosts.includes(parsedUrl.hostname.toLowerCase())) {
      throw new ArteError(
        'Endpoint Livewire không thuộc tên miền được phép của ARTE',
        'UPSTREAM_ENDPOINT_MISSING',
        502
      );
    }

    if (!/^\/_livewire\/[A-Za-z0-9_-]+\/update$/.test(parsedUrl.pathname)) {
      throw new ArteError(
        'Đường dẫn endpoint Livewire không hợp lệ',
        'UPSTREAM_ENDPOINT_MISSING',
        502
      );
    }

    if (!token) {
      throw new ArteError(
        'Không tìm thấy CSRF token Livewire trên trang ARTE',
        'UPSTREAM_TOKEN_MISSING',
        502
      );
    }

    return {
      snapshot,
      token: String(token).trim(),
      updateUrl: parsedUrl.href,
    };
  }

  /**
   * Post update to Livewire endpoint with snapshot and field update.
   */
  async _postLivewireUpdate(updateUrl, token, snapshot, updates) {
    const payload = {
      _token: token,
      components: [
        {
          snapshot,
          updates,
          calls: [
            {
              method: '$commit',
              params: [],
              metadata: {
                type: 'model.live',
              },
            },
          ],
        },
      ],
    };

    const res = await fetchWithCookies(this.fetchFn, this.cookieJar, updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token,
        'X-Livewire': 'true',
        Referer: this.stockPageUrl,
      },
      body: JSON.stringify(payload),
      timeoutMs: this.timeoutMs,
    });

    if (res.status === 419 || res.status === 401) {
      throw new ArteError('Phiên làm việc Livewire đã hết hạn', 'SESSION_EXPIRED', 419);
    }

    if (!res.ok) {
      throw new ArteError(`Lỗi cập nhật Livewire từ ARTE: HTTP ${res.status}`, 'UPSTREAM_UPDATE_ERROR', 503);
    }

    const data = await res.json();
    const component = data?.components?.[0];
    if (!component || !component.snapshot) {
      throw new ArteError('Phản hồi Livewire không hợp lệ từ ARTE', 'INVALID_UPSTREAM_RESPONSE', 502);
    }

    return {
      snapshot: component.snapshot,
      html: component.effects?.html || '',
    };
  }

  /**
   * Extract batches, product name, and image from HTML.
   * Never treats generic headings ("Check our stock", "Result", etc.) as product names.
   */
  _extractBatchesAndProduct(html, reference) {
    const $ = cheerio.load(html);
    const batches = [];

    // Look for select with batch options
    const batchSelect = $('select[name="batch"], select[wire\\:model="batch"], select[wire\\:model\\.live="batch"]');
    const selectToUse = batchSelect.length > 0 ? batchSelect : $('select').filter((_, el) => $(el).find('option').length > 1);

    selectToUse.find('option').each((_, opt) => {
      const val = $(opt).attr('value');
      const text = $(opt).text().trim();
      const candidate = (val !== undefined && val !== null ? String(val).trim() : text);
      if (
        candidate &&
        !/^choose|^select|^--|^placeholder/i.test(candidate) &&
        !/^choose|^select|^--|^placeholder/i.test(text)
      ) {
        if (!batches.includes(candidate)) {
          batches.push(candidate);
        }
      }
    });

    // Product name extraction
    const productName = this._extractProductName($, html, reference);

    // Image URL extraction
    let imageUrl = undefined;
    $('img').each((_, img) => {
      if (imageUrl) return;
      const src = $(img).attr('src') || $(img).attr('data-src');
      const sanitized = sanitizeImageUrl(src);
      if (sanitized) {
        imageUrl = sanitized;
      }
    });

    return {
      batches,
      productName,
      imageUrl,
    };
  }

  /**
   * Helper to parse product name from HTML or DOM.
   * Strictly ignores generic headings like "Check our stock" or "Result".
   */
  _extractProductName($, html, reference) {
    const genericHeaders = [
      'check our stock',
      'result',
      'résultat',
      'resultat',
      'votre recherche',
      'stock check',
      'recherche',
    ];

    const isGeneric = (str) => {
      if (!str) return true;
      const lower = str.trim().toLowerCase();
      return genericHeaders.some((h) => lower === h || lower.startsWith(h + ' '));
    };

    // 1. Explicit classes if not generic
    for (const sel of ['.product-name', '.product-title', '[data-product-name]']) {
      const el = $(sel).first();
      if (el.length > 0) {
        const text = el.text().trim();
        if (text && !isGeneric(text)) {
          return text;
        }
      }
    }

    // 2. Strict text pattern ending with requested reference: e.g. "Tali – 60741" or "Tali - 60741"
    if (reference) {
      const escapedRef = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const refRegex = new RegExp(`([\\p{L}\\p{N}\\s'.,/\\-_]+[–—\\-]\\s*${escapedRef})`, 'u');

      let found = null;
      $('h1, h2, h3, h4, div, p, span').each((_, el) => {
        if (found) return;
        if ($(el).children().length > 3) return; // ignore massive outer containers
        const text = $(el).text().trim();
        if (text && !isGeneric(text) && text.length < 100) {
          const m = text.match(refRegex);
          if (m) {
            found = m[1].trim();
          }
        }
      });
      if (found) return found;

      const rawMatch = html.match(refRegex);
      if (rawMatch) {
        const candidate = rawMatch[1].trim();
        if (!isGeneric(candidate)) {
          return candidate;
        }
      }
    }

    // 3. Image alt fallback if non-generic
    const imgAlt = $('img').map((_, el) => $(el).attr('alt')).get();
    for (const alt of imgAlt) {
      if (alt && !isGeneric(alt) && !/^arte|logo|icon|image$/i.test(alt.trim())) {
        if (reference && !alt.includes(reference)) {
          return `${alt.trim()} – ${reference}`;
        }
        return alt.trim();
      }
    }

    return undefined;
  }

  /**
   * Internal unqueued lookup for batches.
   */
  async _lookupBatchesInternal(reference, forceReauth = false) {
    if (forceReauth) {
      await this._ensureAuthenticated(true);
    }
    const state = await this._getInitialStockPageState();
    const res = await this._postLivewireUpdate(state.updateUrl, state.token, state.snapshot, {
      code: reference,
    });

    const parsed = this._extractBatchesAndProduct(res.html, reference);

    return {
      reference,
      batches: parsed.batches,
      productName: parsed.productName,
      imageUrl: parsed.imageUrl,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * GET Batches for a reference.
   */
  async getBatches(rawReference, options = {}) {
    const reference = validateReference(rawReference);
    if (!reference) {
      throw new ArteError(
        'Mã sản phẩm không hợp lệ (chỉ chấp nhận chữ cái, số, dấu chấm, gạch ngang, gạch chéo, tối đa 40 ký tự)',
        'INVALID_REFERENCE',
        400
      );
    }

    // Check memory cache
    const cached = this.batchesCache.get(reference);
    if (cached) {
      return cached;
    }

    return this.queue.run(async () => {
      // Double check cache inside queue
      const cachedInside = this.batchesCache.get(reference);
      if (cachedInside) return cachedInside;

      let result;
      try {
        result = await this._lookupBatchesInternal(reference, false);
      } catch (err) {
        if (isRetryableSessionError(err)) {
          // Retry once with a fresh authenticated session. This also recovers
          // transient connection resets during the multi-step upstream flow.
          result = await this._lookupBatchesInternal(reference, true);
        } else {
          throw err;
        }
      }

      if (result.batches.length === 0) {
        throw new ArteError(
          `Không tìm thấy lô hàng nào cho mã sản phẩm "${reference}" trên ARTE`,
          'PRODUCT_NOT_FOUND',
          404
        );
      }

      this.batchesCache.set(reference, result);
      return result;
    }, options);
  }

  /**
   * Check stock availability for reference, batch, and amount.
   * Runs a complete fresh Livewire chain per check (code -> batch -> amount) in one queued job.
   * Does NOT enqueue recursively and does NOT share mutable Livewire snapshots.
   */
  async checkStock(rawReference, rawBatch, rawAmount, options = {}) {
    const reference = validateReference(rawReference);
    if (!reference) {
      throw new ArteError('Mã sản phẩm không hợp lệ', 'INVALID_REFERENCE', 400);
    }
    const batch = validateBatch(rawBatch);
    if (!batch) {
      throw new ArteError('Lô hàng không hợp lệ', 'INVALID_BATCH', 400);
    }
    const amount = validateAmount(rawAmount);
    if (amount === null) {
      throw new ArteError('Số lượng phải là số lớn hơn 0 và nhỏ hơn hoặc bằng 100,000', 'INVALID_AMOUNT', 400);
    }

    const cacheKey = `${reference}:${batch}:${amount}`;
    const cached = this.stockCheckCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queue.run(async () => {
      const cachedInside = this.stockCheckCache.get(cacheKey);
      if (cachedInside) return cachedInside;

      const executeFreshChain = async (forceReauth = false) => {
        if (forceReauth) {
          await this._ensureAuthenticated(true);
        }

        // Start with fresh initial state
        const initial = await this._getInitialStockPageState();

        // Step 1: Update code
        const codeRes = await this._postLivewireUpdate(
          initial.updateUrl,
          initial.token,
          initial.snapshot,
          { code: reference }
        );

        // Validate batch exists in returned batches
        const codeParsed = this._extractBatchesAndProduct(codeRes.html, reference);
        if (!codeParsed.batches.includes(batch)) {
          throw new ArteError(
            `Lô hàng không hợp lệ cho mã sản phẩm đã chọn`,
            'INVALID_BATCH',
            400
          );
        }

        // Step 2: Update batch with code snapshot
        const batchRes = await this._postLivewireUpdate(
          initial.updateUrl,
          initial.token,
          codeRes.snapshot,
          { batch }
        );

        // Step 3: Update amount with batch snapshot
        const amountRes = await this._postLivewireUpdate(
          initial.updateUrl,
          initial.token,
          batchRes.snapshot,
          { amount }
        );

        // Classify availability from final HTML
        const finalHtml = amountRes.html;
        const $ = cheerio.load(finalHtml);
        const text = $.text();

        let available = null;
        let message = '';

        if (/The required quantity is not available/i.test(text) || /La quantité requise n'est pas disponible/i.test(text)) {
          available = false;
          message = 'The required quantity is not available.';
        } else if (/The required quantity is available/i.test(text) || /La quantité requise est disponible/i.test(text)) {
          available = true;
          message = 'The required quantity is available.';
        }

        if (available === null) {
          throw new ArteError('Không thể xác định trạng thái tồn kho từ ARTE', 'UPSTREAM_UNCLASSIFIED', 502);
        }

        const finalParsed = this._extractBatchesAndProduct(finalHtml, reference);

        return {
          reference,
          batch,
          amount,
          productName: finalParsed.productName || codeParsed.productName || `${reference}`,
          imageUrl: finalParsed.imageUrl || codeParsed.imageUrl,
          available,
          message,
          checkedAt: new Date().toISOString(),
        };
      };

      let result;
      try {
        result = await executeFreshChain(false);
      } catch (err) {
        if (isRetryableSessionError(err)) {
          // Retry exactly once with reauth; never loop indefinitely.
          result = await executeFreshChain(true);
        } else {
          throw err;
        }
      }

      this.stockCheckCache.set(cacheKey, result);
      return result;
    }, options);
  }
}

// Default singleton instance
export const arteService = new ArteService();
