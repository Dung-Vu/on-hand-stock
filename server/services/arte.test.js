import test from 'node:test';
import assert from 'node:assert/strict';
import { CookieJar } from 'tough-cookie';
import {
  ArteService,
  ArteError,
  STOCK_FORM_WIRE_NAME,
  validateReference,
  validateBatch,
  validateAmount,
  sanitizeImageUrl,
  ConcurrencyQueue,
} from './arte.js';

// Deterministic fixtures matching live ARTE behavior
const FIXTURE_LOGIN_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Login - ARTE</title></head>
<body>
  <form action="https://account.arte-international.com/en/login" method="POST">
    <input type="hidden" name="_token" value="test-csrf-token-xyz" />
    <input type="email" name="email" />
    <input type="password" name="password" />
  </form>
</body>
</html>
`;

// Account home returned after 302 from login POST
const FIXTURE_ACCOUNT_HOME_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Account - ARTE</title></head>
<body>
  <div class="user-greeting">Welcome back, Partner!</div>
  <a href="https://account.arte-international.com/en/login">Switch account / Login</a>
</body>
</html>
`;

// Protected stock page with multiple components and Livewire script tag
const FIXTURE_STOCK_PAGE_INITIAL = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://www.arte-international.com/livewire-dff0deec/livewire.min.js?v=3"
          data-no-progress-bar
          data-csrf="livewire-csrf-token-123"
          data-module-url="https://www.arte-international.com/livewire-dff0deec"
          data-update-uri="https://www.arte-international.com/_livewire/livewire-dff0deec/update">
  </script>
</head>
<body>
  <!-- Header navigation component with wire:snapshot (MUST NOT be selected!) -->
  <div wire:id="comp-header-nav"
       wire:name="app.front.features.header.navigation"
       wire:snapshot="{&quot;data&quot;:{&quot;nav&quot;:true},&quot;memo&quot;:{&quot;id&quot;:&quot;comp-header-nav&quot;,&quot;name&quot;:&quot;header-nav&quot;}}">
    <nav>Navigation Menu</nav>
  </div>

  <!-- Search component with wire:snapshot -->
  <div wire:id="comp-search"
       wire:name="app.front.features.search.bar"
       wire:snapshot="{&quot;data&quot;:{&quot;query&quot;:&quot;&quot;},&quot;memo&quot;:{&quot;id&quot;:&quot;comp-search&quot;,&quot;name&quot;:&quot;search-bar&quot;}}">
    <input name="search" />
  </div>

  <!-- Exact stock check form component -->
  <div wire:id="comp-stock-form"
       wire:name="${STOCK_FORM_WIRE_NAME}"
       wire:snapshot="{&quot;data&quot;:{&quot;code&quot;:&quot;&quot;,&quot;batch&quot;:&quot;&quot;,&quot;amount&quot;:null},&quot;memo&quot;:{&quot;id&quot;:&quot;comp-stock-form&quot;,&quot;name&quot;:&quot;${STOCK_FORM_WIRE_NAME}&quot;}}">
    <input wire:model.live="code" type="text" name="code" />
  </div>
</body>
</html>
`;

// Realistic code-update HTML: heading "Check our stock" plus Batch options, NO product result yet
const FIXTURE_EFFECTS_CODE_60741 = `
<div wire:id="comp-stock-form">
  <h2>Check our stock</h2>
  <select name="batch" wire:model.live="batch">
    <option value="">Choose a batch</option>
    <option value="02512120">02512120</option>
    <option value="02603260">02603260</option>
    <option value="02411250">02411250</option>
    <option value="02606190">02606190</option>
    <option value="02509090">02509090</option>
  </select>
</div>
`;

// Realistic batch update HTML
const FIXTURE_EFFECTS_BATCH = `
<div wire:id="comp-stock-form">
  <h2>Check our stock</h2>
  <input name="amount" value="" />
</div>
`;

// Realistic amount-result HTML: heading "Result", img alt, plain div "Tali – 60741", availability text
const FIXTURE_EFFECTS_AMOUNT_UNAVAILABLE = `
<div wire:id="comp-stock-form">
  <h2>Result</h2>
  <img src="https://edge.arte-international.com/media/products/60741/tali.jpg" alt="Tali" />
  <div>Tali – 60741</div>
  <p>The required quantity is not available.</p>
</div>
`;

const FIXTURE_EFFECTS_AMOUNT_AVAILABLE = `
<div wire:id="comp-stock-form">
  <h2>Result</h2>
  <img src="https://edge.arte-international.com/media/products/60741/tali.jpg" alt="Tali" />
  <div>Tali – 60741</div>
  <p>The required quantity is available.</p>
</div>
`;

const FIXTURE_EFFECTS_AMOUNT_UNKNOWN = `
<div wire:id="comp-stock-form">
  <h2>Result</h2>
  <div>Tali – 60741</div>
  <p>Please contact customer support for further information.</p>
</div>
`;

function createMockFetch(handlers = {}) {
  const calls = [];

  const mockFn = async (url, options = {}) => {
    calls.push({ url, options });

    if (handlers.custom) {
      const res = await handlers.custom(url, options, calls.length);
      if (res) return res;
    }

    // Default mock routing
    if (url.includes('/login?service=front')) {
      return new Response(FIXTURE_LOGIN_PAGE, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (url.endsWith('/login') && options.method === 'POST') {
      return new Response('', {
        status: 302,
        headers: {
          'Set-Cookie': 'arte_session=test-session-val; Path=/; Domain=.arte-international.com; HttpOnly',
          Location: 'https://account.arte-international.com/en',
        },
      });
    }

    if (url === 'https://account.arte-international.com/en') {
      return new Response(FIXTURE_ACCOUNT_HOME_PAGE, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (url.includes('/check-our-stock')) {
      return new Response(FIXTURE_STOCK_PAGE_INITIAL, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (url.includes('/_livewire/livewire-dff0deec/update')) {
      const body = JSON.parse(options.body || '{}');
      const comp = body.components?.[0] || {};
      const updates = comp.updates || {};

      if ('code' in updates) {
        return new Response(
          JSON.stringify({
            components: [
              {
                snapshot: JSON.stringify({ state: 'after_code', code: updates.code }),
                effects: { html: FIXTURE_EFFECTS_CODE_60741 },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if ('batch' in updates) {
        return new Response(
          JSON.stringify({
            components: [
              {
                snapshot: JSON.stringify({ state: 'after_batch', batch: updates.batch }),
                effects: { html: FIXTURE_EFFECTS_BATCH },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if ('amount' in updates) {
        const effectsHtml = handlers.amountHtml || FIXTURE_EFFECTS_AMOUNT_UNAVAILABLE;
        return new Response(
          JSON.stringify({
            components: [
              {
                snapshot: JSON.stringify({ state: 'after_amount', amount: updates.amount }),
                effects: { html: effectsHtml },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  };

  mockFn.calls = calls;
  return mockFn;
}

test('ArteService parses initial Livewire state, token, and discovered update URI from script[data-update-uri]', async () => {
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
  });

  const state = service._parseLivewireStateFromHtml(FIXTURE_STOCK_PAGE_INITIAL);
  assert.equal(state.token, 'livewire-csrf-token-123');
  assert.equal(state.updateUrl, 'https://www.arte-international.com/_livewire/livewire-dff0deec/update');
  assert.ok(state.snapshot.includes('comp-stock-form'));
});

test('ArteService selects exact stock form component among multiple wire components and never selects first component', async () => {
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
  });

  const snapshot = service._extractStockFormSnapshot(FIXTURE_STOCK_PAGE_INITIAL);
  // Must NOT select comp-header-nav (the first component)
  assert.ok(!snapshot.includes('comp-header-nav'));
  assert.ok(!snapshot.includes('comp-search'));
  // Must select comp-stock-form
  assert.ok(snapshot.includes('comp-stock-form'));
  assert.ok(snapshot.includes(STOCK_FORM_WIRE_NAME));
});

test('ArteService falls back to closest ancestor around input[name=code] if wire:name not directly matched', () => {
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
  });

  const customHtml = `
  <div>
    <div wire:id="comp-wrong" wire:snapshot="{&quot;wrong&quot;:true}">Wrong</div>
    <div wire:id="comp-fallback" wire:snapshot="{&quot;data&quot;:{&quot;fallback&quot;:true},&quot;memo&quot;:{&quot;id&quot;:&quot;comp-fallback&quot;}}">
      <div>
        <input name="code" type="text" />
      </div>
    </div>
  </div>
  `;

  const snapshot = service._extractStockFormSnapshot(customHtml);
  assert.ok(snapshot.includes('comp-fallback'));
});

test('ArteService fails closed with UPSTREAM_ENDPOINT_MISSING when update URI is missing, wrong host, or invalid path', () => {
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
  });

  // Missing data-update-uri
  assert.throws(
    () => {
      service._parseLivewireStateFromHtml(`
        <script data-csrf="token123"></script>
        <div wire:id="c" wire:name="${STOCK_FORM_WIRE_NAME}" wire:snapshot="{}"></div>
      `);
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'UPSTREAM_ENDPOINT_MISSING');
      assert.equal(err.status, 502);
      return true;
    }
  );

  // Wrong host (malicious external endpoint)
  assert.throws(
    () => {
      service._parseLivewireStateFromHtml(`
        <script data-csrf="token123" data-update-uri="https://evil.com/_livewire/hash123/update"></script>
        <div wire:id="c" wire:name="${STOCK_FORM_WIRE_NAME}" wire:snapshot="{}"></div>
      `);
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'UPSTREAM_ENDPOINT_MISSING');
      return true;
    }
  );

  // Invalid path (not /_livewire/<hash>/update)
  assert.throws(
    () => {
      service._parseLivewireStateFromHtml(`
        <script data-csrf="token123" data-update-uri="https://www.arte-international.com/api/fake/update"></script>
        <div wire:id="c" wire:name="${STOCK_FORM_WIRE_NAME}" wire:snapshot="{}"></div>
      `);
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'UPSTREAM_ENDPOINT_MISSING');
      return true;
    }
  );
});

test('ArteService parses five batches for reference 60741', async () => {
  const mockFetch = createMockFetch();
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  const res = await service.getBatches('60741');
  assert.equal(res.reference, '60741');
  assert.deepEqual(res.batches, ['02512120', '02603260', '02411250', '02606190', '02509090']);
  assert.equal(res.batches.length, 5);
  assert.ok(res.checkedAt);
});

test('Product name is absent from batches response and becomes "Tali – 60741" on final result', async () => {
  const mockFetch = createMockFetch();
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  // Batches response has heading "Check our stock" which must NOT be treated as product name
  const batchesRes = await service.getBatches('60741');
  assert.notEqual(batchesRes.productName, 'Check our stock');
  assert.equal(batchesRes.productName, undefined);

  // Final checkStock parses amount response containing <div>Tali – 60741</div>
  const checkRes = await service.checkStock('60741', '02512120', 1);
  assert.equal(checkRes.productName, 'Tali – 60741');
  assert.notEqual(checkRes.productName, 'Result');
  assert.notEqual(checkRes.productName, 'Check our stock');
});

test('ArteService chains snapshots code -> batch -> amount strictly and fresh per check', async () => {
  const mockFetch = createMockFetch();
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  const checkRes = await service.checkStock('60741', '02512120', 2.5);
  assert.equal(checkRes.available, false);
  assert.equal(checkRes.amount, 2.5);
  assert.equal(checkRes.message, 'The required quantity is not available.');

  // Verify the chained calls to the update endpoint
  const updateCalls = mockFetch.calls.filter((c) =>
    c.url.includes('/_livewire/livewire-dff0deec/update')
  );

  assert.equal(updateCalls.length, 3);
  updateCalls.forEach((call) => {
    assert.equal(new Headers(call.options.headers).get('X-Livewire'), 'true');
  });

  const payload1 = JSON.parse(updateCalls[0].options.body);
  const payload2 = JSON.parse(updateCalls[1].options.body);
  const payload3 = JSON.parse(updateCalls[2].options.body);

  // Step 1: code update uses initial snapshot
  assert.deepEqual(payload1.components[0].updates, { code: '60741' });
  assert.ok(payload1.components[0].snapshot.includes('comp-stock-form'));

  // Step 2: batch update uses snapshot from code step
  assert.deepEqual(payload2.components[0].updates, { batch: '02512120' });
  assert.ok(payload2.components[0].snapshot.includes('after_code'));

  // Step 3: amount update uses snapshot from batch step
  assert.deepEqual(payload3.components[0].updates, { amount: 2.5 });
  assert.ok(payload3.components[0].snapshot.includes('after_batch'));
});

test('Two concurrent cold checkStock calls complete without deadlock within short timeout', async () => {
  const mockFetch = createMockFetch();
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
    maxConcurrency: 2,
  });

  // Short timeout promise to ensure no deadlock occurs
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Deadlock detected! Concurrent checkStock timed out')), 2500)
  );

  const check1Promise = service.checkStock('60741', '02512120', 1);
  const check2Promise = service.checkStock('60741', '02603260', 2);

  const [res1, res2] = await Promise.race([
    Promise.all([check1Promise, check2Promise]),
    timeoutPromise,
  ]);

  assert.equal(res1.reference, '60741');
  assert.equal(res1.batch, '02512120');
  assert.equal(res2.reference, '60741');
  assert.equal(res2.batch, '02603260');
});

test('ArteService verifies login through protected stock page even when login redirects to account home', async () => {
  let loginGetCalls = 0;
  let loginPostCalls = 0;
  let stockGetCalls = 0;
  let isLoggedIn = false;

  const mockFetch = async (url, options = {}) => {
    // When not logged in yet, stock page redirects to login
    if (url.includes('/check-our-stock') && !isLoggedIn) {
      stockGetCalls++;
      return new Response('', {
        status: 302,
        headers: {
          Location: 'https://account.arte-international.com/en/login?service=front',
        },
      });
    }

    if (url.includes('/login?service=front')) {
      loginGetCalls++;
      return new Response(FIXTURE_LOGIN_PAGE, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    if (url.endsWith('/login') && options.method === 'POST') {
      loginPostCalls++;
      isLoggedIn = true;
      // Live ARTE redirects to https://account.arte-international.com/en with 302
      return new Response('', {
        status: 302,
        headers: {
          'Set-Cookie': 'arte_auth=auth-token-123; Path=/; Domain=.arte-international.com; HttpOnly',
          Location: 'https://account.arte-international.com/en',
        },
      });
    }

    if (url === 'https://account.arte-international.com/en') {
      return new Response(FIXTURE_ACCOUNT_HOME_PAGE, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (url.includes('/check-our-stock') && isLoggedIn) {
      stockGetCalls++;
      return new Response(FIXTURE_STOCK_PAGE_INITIAL, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (url.includes('/_livewire/livewire-dff0deec/update')) {
      return new Response(
        JSON.stringify({
          components: [
            {
              snapshot: JSON.stringify({ state: 'after_code', code: '60741' }),
              effects: { html: FIXTURE_EFFECTS_CODE_60741 },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  };

  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  const res = await service.getBatches('60741');
  assert.equal(loginGetCalls, 1);
  assert.equal(loginPostCalls, 1);
  assert.ok(stockGetCalls >= 2); // Initial check redirected, then verified after login
  assert.equal(res.batches.length, 5);
});

test('ArteService returns available: true when upstream confirms available', async () => {
  const mockFetch = createMockFetch({ amountHtml: FIXTURE_EFFECTS_AMOUNT_AVAILABLE });
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  const res = await service.checkStock('60741', '02603260', 5);
  assert.equal(res.available, true);
  assert.equal(res.message, 'The required quantity is available.');
  assert.equal(res.amount, 5);
  assert.equal(res.batch, '02603260');
});

test('ArteService rejects unknown result and fails closed with 502/UPSTREAM_UNCLASSIFIED', async () => {
  const mockFetch = createMockFetch({ amountHtml: FIXTURE_EFFECTS_AMOUNT_UNKNOWN });
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  await assert.rejects(
    async () => {
      await service.checkStock('60741', '02512120', 1);
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'UPSTREAM_UNCLASSIFIED');
      assert.equal(err.status, 502);
      return true;
    }
  );
});

test('ArteService rejects batch not returned by ARTE for that reference', async () => {
  const mockFetch = createMockFetch();
  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  await assert.rejects(
    async () => {
      await service.checkStock('60741', '09999999', 1);
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'INVALID_BATCH');
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test('ArteService deduplicates concurrent logins via mutex', async () => {
  let loginPostCount = 0;
  let isLoggedIn = false;
  const mockFetch = createMockFetch({
    custom: async (url, options) => {
      if (url.includes('/check-our-stock') && !isLoggedIn) {
        return new Response('', {
          status: 302,
          headers: {
            Location: 'https://account.arte-international.com/en/login?service=front',
          },
        });
      }
      if (url.endsWith('/login') && options.method === 'POST') {
        loginPostCount++;
        isLoggedIn = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new Response('', {
          status: 302,
          headers: {
            'Set-Cookie': 'session=xyz; Path=/; Domain=.arte-international.com',
            Location: 'https://account.arte-international.com/en',
          },
        });
      }
      return null;
    },
  });

  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  // Launch 3 concurrent requests while not logged in
  await Promise.all([
    service.getBatches('60741'),
    service.getBatches('60741'),
    service.getBatches('60741'),
  ]);

  // Login POST should execute exactly once
  assert.equal(loginPostCount, 1);
});

test('ArteService handles controlled re-login and retry on 419 Page Expired', async () => {
  let updateAttempts = 0;
  let reLoginAttempts = 0;

  const mockFetch = createMockFetch({
    custom: async (url, options) => {
      if (url.endsWith('/login') && options.method === 'POST') {
        reLoginAttempts++;
        return new Response('', {
          status: 302,
          headers: {
            'Set-Cookie': 'session=fresh-session; Path=/; Domain=.arte-international.com',
            Location: 'https://account.arte-international.com/en',
          },
        });
      }
      if (url.includes('/_livewire/livewire-dff0deec/update')) {
        updateAttempts++;
        if (updateAttempts === 1) {
          // First attempt fails with 419
          return new Response('Page Expired', { status: 419 });
        }
        // Second attempt succeeds
        return new Response(
          JSON.stringify({
            components: [
              {
                snapshot: JSON.stringify({ state: 'after_code', code: '60741' }),
                effects: { html: FIXTURE_EFFECTS_CODE_60741 },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return null;
    },
  });

  const service = new ArteService({
    email: 'test@example.com',
    password: 'secure-password',
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  const res = await service.getBatches('60741');
  assert.equal(res.batches.length, 5);
  assert.ok(reLoginAttempts >= 1);
  assert.equal(updateAttempts, 2);
});

test('ArteService redacts sensitive data and does not leak credentials in errors', async () => {
  const secretPassword = 'my-secret-arte-password-12345';
  const secretEmail = 'agent@secret-arte-corp.com';

  const mockFetch = async () => {
    throw new Error('Connection refused to backend');
  };

  const service = new ArteService({
    email: secretEmail,
    password: secretPassword,
    fetchFn: mockFetch,
    cookieJar: new CookieJar(),
  });

  await assert.rejects(
    async () => {
      await service.getBatches('60741');
    },
    (err) => {
      assert.ok(!err.message.includes(secretPassword));
      assert.ok(!err.message.includes(secretEmail));
      return true;
    }
  );
});

test('Image URL sanitization allows only absolute https on arte hosts and omits others', () => {
  // Valid hosts
  assert.equal(
    sanitizeImageUrl('https://edge.arte-international.com/images/123.jpg'),
    'https://edge.arte-international.com/images/123.jpg'
  );
  assert.equal(
    sanitizeImageUrl('https://arte-international.com/images/123.jpg'),
    'https://arte-international.com/images/123.jpg'
  );
  assert.equal(
    sanitizeImageUrl('https://www.arte-international.com/images/123.jpg'),
    'https://www.arte-international.com/images/123.jpg'
  );

  // Invalid hosts / protocols
  assert.equal(sanitizeImageUrl('http://arte-international.com/images/123.jpg'), undefined);
  assert.equal(sanitizeImageUrl('https://malicious-site.com/image.png'), undefined);
  assert.equal(sanitizeImageUrl('https://malicious.com?fake=arte-international.com'), undefined);
  assert.equal(sanitizeImageUrl('/relative/path/image.jpg'), undefined);
  assert.equal(sanitizeImageUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeImageUrl(''), undefined);
  assert.equal(sanitizeImageUrl(null), undefined);
});

test('Input validators accept valid values and reject invalid values including control characters and illegal batches', () => {
  // Reference
  assert.equal(validateReference('60741'), '60741');
  assert.equal(validateReference('  60741  '), '60741');
  assert.equal(validateReference('ABC-123.45/X'), 'ABC-123.45/X');
  assert.equal(validateReference(''), null);
  assert.equal(validateReference('a'.repeat(41)), null);
  assert.equal(validateReference('<script>'), null);
  assert.equal(validateReference('ref\r\ninjection'), null);

  // Batch: conservative token characters (letters, digits, dot, dash, underscore, slash)
  assert.equal(validateBatch('02512120'), '02512120');
  assert.equal(validateBatch('BATCH.01-A_2/X'), 'BATCH.01-A_2/X');
  assert.equal(validateBatch(''), null);
  assert.equal(validateBatch('   '), null);
  assert.equal(validateBatch('a'.repeat(61)), null);
  assert.equal(validateBatch('batch with spaces'), null);
  assert.equal(validateBatch('batch\r\nCRLF'), null);
  assert.equal(validateBatch('batch\x00NULL'), null);
  assert.equal(validateBatch('<tag>'), null);

  // Amount: positive finite numbers including decimals
  assert.equal(validateAmount(1), 1);
  assert.equal(validateAmount('50'), 50);
  assert.equal(validateAmount('2.5'), 2.5);
  assert.equal(validateAmount(0.75), 0.75);
  assert.equal(validateAmount(0), null);
  assert.equal(validateAmount(-1), null);
  assert.equal(validateAmount(100001), null);
  assert.equal(validateAmount('invalid'), null);
});

test('Finding E: ConcurrencyQueue rejects immediately on overflow when queue is full', async () => {
  const queue = new ConcurrencyQueue(1, 2, 5000);
  let releaseFirstJob;
  const firstJobPromise = new Promise((resolve) => {
    releaseFirstJob = resolve;
  });

  // Start active job (running = 1)
  const job1 = queue.run(() => firstJobPromise);

  // Queue two waiting jobs (queue size reaches maxQueueSize 2)
  const job2 = queue.run(() => Promise.resolve('job2'));
  const job3 = queue.run(() => Promise.resolve('job3'));

  // Fourth job exceeds queue capacity -> must reject immediately with 429 / QUEUE_FULL
  await assert.rejects(
    async () => {
      await queue.run(() => Promise.resolve('job4'));
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'QUEUE_FULL');
      assert.equal(err.status, 429);
      return true;
    }
  );

  releaseFirstJob('job1');
  const [res1, res2, res3] = await Promise.all([job1, job2, job3]);
  assert.equal(res1, 'job1');
  assert.equal(res2, 'job2');
  assert.equal(res3, 'job3');
});

test('Finding E: queued timeout rejects cleanly and does not execute upstream later', async () => {
  const queue = new ConcurrencyQueue(1, 5, 50); // 50ms wait timeout
  let releaseJob1;
  const job1Promise = new Promise((resolve) => {
    releaseJob1 = resolve;
  });

  // Active job runs for 120ms
  const job1 = queue.run(() => job1Promise);

  let upstream2Executed = false;
  const job2 = queue.run(async () => {
    upstream2Executed = true;
    return 'upstream2';
  });

  // Job 2 times out while waiting in queue (after 50ms)
  await assert.rejects(
    async () => {
      await job2;
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'QUEUE_TIMEOUT');
      assert.equal(err.status, 504);
      return true;
    }
  );

  // Release job 1 after job 2 timed out
  releaseJob1('job1');
  assert.equal(await job1, 'job1');

  // Wait extra time to ensure job 2 is NEVER executed upstream later
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(upstream2Executed, false, 'Timed-out queued job must NEVER execute upstream later');
});

test('Finding E: ConcurrencyQueue preserves max active 2 strictly', async () => {
  const queue = new ConcurrencyQueue(2, 20, 5000);
  let activeCount = 0;
  let peakActive = 0;

  const makeJob = (id, delayMs) => async () => {
    activeCount++;
    if (activeCount > peakActive) {
      peakActive = activeCount;
    }
    await new Promise((r) => setTimeout(r, delayMs));
    activeCount--;
    return id;
  };

  const results = await Promise.all([
    queue.run(makeJob(1, 40)),
    queue.run(makeJob(2, 40)),
    queue.run(makeJob(3, 40)),
    queue.run(makeJob(4, 40)),
    queue.run(makeJob(5, 40)),
  ]);

  assert.deepEqual(results, [1, 2, 3, 4, 5]);
  assert.ok(peakActive <= 2, `Peak active concurrency was ${peakActive}, must be <= 2`);
});

test('Finding E: browser abort signal cancels queued job before execution', async () => {
  const queue = new ConcurrencyQueue(1, 5, 5000);
  let releaseJob1;
  const job1 = queue.run(() => new Promise((resolve) => { releaseJob1 = resolve; }));

  const controller = new AbortController();
  let upstreamRan = false;
  const job2 = queue.run(async () => {
    upstreamRan = true;
    return 'job2';
  }, { signal: controller.signal });

  // Abort while waiting in queue
  controller.abort();

  await assert.rejects(
    async () => {
      await job2;
    },
    (err) => {
      assert.ok(err instanceof ArteError);
      assert.equal(err.code, 'CLIENT_ABORTED');
      return true;
    }
  );

  releaseJob1('done');
  await job1;
  assert.equal(upstreamRan, false, 'Aborted job must not run upstream');
});
