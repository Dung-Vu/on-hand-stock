import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { Agent } from 'undici';
import { BoundedCache, ConcurrencyQueue } from './arte.js';

const ORIGIN = 'https://partner.gimmersta.com';
const dispatcher = new Agent({ connect: { timeout: 20000 } });

export class GimmerstaError extends Error {
  constructor(message, code = 'UPSTREAM_ERROR', status = 503) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Only an article number, numeric product ID, or an exact product-detail URL; never fetch user-provided URLs.
export function parseLookup(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const url = /^https:\/\/partner\.gimmersta\.com\/products\/(\d{1,10})\/?$/.exec(input);
  if (url) return { id: url[1] };
  if (/^\d{1,10}$/.test(input)) return { id: input };
  if (/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(input)) return { article: input };
  return null;
}

export function parseProduct(html, url, expectedArticle) {
  const $ = cheerio.load(html);
  const main = $('main');
  const fields = new Map();
  main.find('dt').each((_, element) => {
    const label = $(element).text().trim();
    fields.set(label, $(element).next('dd').text().trim());
  });
  const article = fields.get('Article No');
  if (!article || (expectedArticle && article.toLowerCase() !== expectedArticle.toLowerCase())) {
    throw new GimmerstaError('Không tìm thấy mã sản phẩm trên Gimmersta', 'PRODUCT_NOT_FOUND', 404);
  }
  const stockSection = main.find('#batch').first();
  const stockLabel = main
    .find('dt')
    .filter((_, e) => $(e).text().trim() === 'Stock / Batch')
    .first();
  let status;
  let rolls = null;
  let batches = [];
  if (stockSection.length) {
    const options = stockSection.find('option').toArray();
    const auto = options.find(e => $(e).attr('value') === 'auto');
    const match = auto && /max\s+([\d,]+)\s+Rolls?\b/i.exec($(auto).text().replace(/\s+/g, ' '));
    if (!match)
      throw new GimmerstaError('Không đọc được số cuộn từ Gimmersta', 'UPSTREAM_UNCLASSIFIED', 502);
    rolls = Number(match[1].replace(/,/g, ''));
    status = 'in_stock';
    batches = options
      .filter(e => $(e).attr('value') !== 'auto')
      .map(e => {
        const text = $(e).text().replace(/\s+/g, ' ').trim();
        const quantity = /:\s*([\d,]+)\s+Rolls?\b/i.exec(text);
        return {
          batch: $(e).attr('value') || '',
          rolls: quantity ? Number(quantity[1].replace(/,/g, '')) : null,
        };
      })
      .filter(b => /^[a-zA-Z0-9._-]{1,60}$/.test(b.batch));
  } else {
    const text = stockLabel.next('dd').text().replace(/\s+/g, ' ').trim();
    if (!/^Produced on demand in 2-3 days$/i.test(text)) {
      throw new GimmerstaError(
        'Không xác định được trạng thái sản phẩm từ Gimmersta',
        'UPSTREAM_UNCLASSIFIED',
        502
      );
    }
    status = 'on_demand';
  }
  const image = main
    .find('img[src*="res.cloudinary.com/gimmersta-wallpaper/"]')
    .first()
    .attr('src');
  return {
    article,
    name: fields.get('Product Name') || '',
    collection: fields.get('Collection Name') || '',
    status,
    rolls,
    batches,
    productionMessage: status === 'on_demand' ? 'Produced on demand in 2-3 days' : null,
    imageUrl:
      image && /^https:\/\/res\.cloudinary\.com\/gimmersta-wallpaper\//.test(image) ? image : null,
    productUrl: url,
    checkedAt: new Date().toISOString(),
  };
}

export class GimmerstaService {
  constructor(options = {}) {
    this.email = options.email ?? process.env.GIMMERSTA_EMAIL;
    this.password = options.password ?? process.env.GIMMERSTA_PASSWORD;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.jar = new CookieJar();
    this.queue = new ConcurrencyQueue(2, 30, 15000);
    this.cache = new BoundedCache(200, 60000);
    this.loginPromise = null;
    this.loggedIn = false;
  }

  isConfigured() {
    return Boolean(this.email && this.password);
  }

  async request(path, options = {}) {
    let url = new URL(path, ORIGIN);
    for (let count = 0; count < 5; count++) {
      if (url.origin !== ORIGIN)
        throw new GimmerstaError('Chuyển hướng ngoài Gimmersta', 'UPSTREAM_ERROR', 502);
      const headers = new Headers(options.headers || {});
      const cookie = await this.jar.getCookieString(url.href);
      if (cookie) headers.set('Cookie', cookie);
      let response;
      try {
        response = await this.fetchFn(url.href, {
          method: options.method || 'GET',
          body: options.body,
          headers,
          redirect: 'manual',
          dispatcher,
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        throw new GimmerstaError('Không thể kết nối tới Gimmersta', 'UPSTREAM_NETWORK_ERROR', 503);
      }
      for (const value of response.headers.getSetCookie?.() || [])
        await this.jar.setCookie(value, url.href);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new GimmerstaError('Chuyển hướng không hợp lệ', 'UPSTREAM_ERROR', 502);
        url = new URL(location, url);
        if (options.method === 'POST') return { response, url: url.href };
        continue;
      }
      return { response, url: url.href };
    }
    throw new GimmerstaError('Gimmersta chuyển hướng quá nhiều lần', 'UPSTREAM_ERROR', 502);
  }

  async login() {
    if (!this.isConfigured())
      throw new GimmerstaError('Thiếu cấu hình Gimmersta', 'CONFIG_MISSING', 503);
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = (async () => {
      this.jar = new CookieJar();
      const { response } = await this.request('/login');
      if (!response.ok)
        throw new GimmerstaError('Không truy cập được trang đăng nhập', 'UPSTREAM_ERROR', 503);
      const html = await response.text();
      const $ = cheerio.load(html);
      const form = $('form[wire\\:submit\\.prevent="attemptLogin"]').first();
      const initial = form.attr('wire:initial-data');
      const token = /window\.livewire_token\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1];
      if (!initial || !token)
        throw new GimmerstaError(
          'Gimmersta đã thay đổi form đăng nhập',
          'UPSTREAM_UNCLASSIFIED',
          502
        );
      let state;
      try {
        state = JSON.parse(initial);
      } catch {
        throw new GimmerstaError('Form đăng nhập không hợp lệ', 'UPSTREAM_UNCLASSIFIED', 502);
      }
      const wireName = state.fingerprint?.name;
      if (!/^sub-domain\.partner-web\.http\.livewire\.login$/.test(wireName || '')) {
        throw new GimmerstaError('Form đăng nhập không hợp lệ', 'UPSTREAM_UNCLASSIFIED', 502);
      }
      // Livewire v2 requires a payload.id on every update. Server responses carry only
      // a delta of serverMemo; merge it before sending the next update/checksum.
      const updates = [
        { type: 'syncInput', payload: { id: 'email', name: 'email', value: this.email } },
        { type: 'syncInput', payload: { id: 'password', name: 'password', value: this.password } },
        { type: 'callMethod', payload: { id: 'login', method: 'attemptLogin', params: [] } },
      ];
      let payload;
      for (const update of updates) {
        const result = await this.request(`/livewire/message/${wireName}`, {
          method: 'POST',
          body: JSON.stringify({
            fingerprint: state.fingerprint,
            serverMemo: state.serverMemo,
            updates: [update],
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': token,
            'X-Livewire': 'true',
            Accept: 'application/json',
            Referer: `${ORIGIN}/login`,
          },
        });
        if (!result.response.ok)
          throw new GimmerstaError(
            'Đăng nhập Gimmersta không thành công',
            'AUTHENTICATION_FAILED',
            503
          );
        try {
          payload = await result.response.json();
        } catch {
          throw new GimmerstaError('Phản hồi đăng nhập không hợp lệ', 'AUTHENTICATION_FAILED', 503);
        }
        if (payload.serverMemo?.errors && Object.keys(payload.serverMemo.errors).length) {
          throw new GimmerstaError(
            'Đăng nhập Gimmersta không thành công',
            'AUTHENTICATION_FAILED',
            503
          );
        }
        if (!payload.serverMemo?.checksum) {
          throw new GimmerstaError('Phiên Livewire không hợp lệ', 'AUTHENTICATION_FAILED', 503);
        }
        state.serverMemo = {
          ...state.serverMemo,
          ...payload.serverMemo,
          data: { ...state.serverMemo.data, ...payload.serverMemo.data },
        };
      }
      if (!payload.effects?.redirect) {
        throw new GimmerstaError(
          'Đăng nhập Gimmersta không thành công',
          'AUTHENTICATION_FAILED',
          503
        );
      }
      const { response: probe, url } = await this.request('/start');
      if (!probe.ok || new URL(url).pathname === '/login') {
        throw new GimmerstaError(
          'Đăng nhập Gimmersta không thành công',
          'AUTHENTICATION_FAILED',
          503
        );
      }
      await probe.body?.cancel();
      this.loggedIn = true;
    })();
    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  async lookup(input) {
    const parsed = parseLookup(input);
    if (!parsed)
      throw new GimmerstaError('Mã hoặc link sản phẩm không hợp lệ', 'INVALID_INPUT', 400);
    const key = parsed.id ? `id:${parsed.id}` : `article:${parsed.article.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    return this.queue.run(async () => {
      const existing = this.cache.get(key);
      if (existing) return existing;
      if (!this.loggedIn) await this.login();
      const path = parsed.id
        ? `/products/${parsed.id}`
        : `/products?no=${encodeURIComponent(parsed.article)}&wallpapers=true&customWallMurals=true`;
      let { response, url } = await this.request(path);
      if (
        new URL(url).pathname === '/login' ||
        response.status === 401 ||
        response.status === 419
      ) {
        this.loggedIn = false;
        await this.login();
        ({ response, url } = await this.request(path));
      }
      if (new URL(url).pathname === '/login')
        throw new GimmerstaError('Phiên Gimmersta hết hạn', 'AUTHENTICATION_FAILED', 503);
      if (response.status === 404)
        throw new GimmerstaError('Không tìm thấy sản phẩm', 'PRODUCT_NOT_FOUND', 404);
      if (!response.ok)
        throw new GimmerstaError('Gimmersta tạm thời không phản hồi', 'UPSTREAM_ERROR', 503);
      // A search listing is not a product detail; never report its first result as a match.
      if (!/^\/products\/\d+$/.test(new URL(url).pathname)) {
        throw new GimmerstaError('Không tìm thấy đúng mã sản phẩm', 'PRODUCT_NOT_FOUND', 404);
      }
      const data = parseProduct(await response.text(), url, parsed.article);
      this.cache.set(key, data);
      return data;
    });
  }
}

export const gimmerstaService = new GimmerstaService();
