import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLookup, parseProduct, GimmerstaService } from './gimmersta.js';

const product = (article, stock) => `<main><dl>
  <div><dt>Article No</dt><dd>${article}</dd></div>
  <div><dt>Product Name</dt><dd>Sample Product</dd></div>
  <div><dt>Collection Name</dt><dd>Collection</dd></div>
  ${stock}
</dl></main>`;
const rolls = `<label>Stock / Batch</label><select id="batch">
  <option value="auto">Auto selected batch, max 685 Roll</option>
  <option value="260813">260813 : 124 Roll</option>
</select>`;
const onDemand = '<div><dt>Stock / Batch</dt><dd>Produced on demand in 2-3 days</dd></div>';

test('only exact product IDs/article numbers/partner detail URLs are accepted', () => {
  assert.deepEqual(parseLookup('https://partner.gimmersta.com/products/28350'), { id: '28350' });
  assert.deepEqual(parseLookup('805-21'), { article: '805-21' });
  for (const input of [
    'http://partner.gimmersta.com/products/3',
    'https://evil.com/products/3',
    'https://partner.gimmersta.com/products/3?redirect=evil.com',
    '../login',
    '',
  ]) {
    assert.equal(parseLookup(input), null);
  }
});

test('stock parse uses max auto roll, never sums batch stock', () => {
  const parsed = parseProduct(
    product('101-16', rolls),
    'https://partner.gimmersta.com/products/28350',
    '101-16'
  );
  assert.equal(parsed.status, 'in_stock');
  assert.equal(parsed.rolls, 685);
  assert.deepEqual(parsed.batches, [{ batch: '260813', rolls: 124 }]);
});

test('custom mural does not claim stock; unknown or mismatched pages fail closed', () => {
  const mural = parseProduct(
    product('652-36', onDemand),
    'https://partner.gimmersta.com/products/2754'
  );
  assert.equal(mural.rolls, null);
  assert.equal(mural.status, 'on_demand');
  assert.equal(mural.productionMessage, 'Produced on demand in 2-3 days');
  assert.throws(
    () =>
      parseProduct(
        product('652-36', onDemand),
        'https://partner.gimmersta.com/products/2754',
        'other'
      ),
    { code: 'PRODUCT_NOT_FOUND' }
  );
  assert.throws(
    () =>
      parseProduct(
        product('652-36', '<div><dt>Stock / Batch</dt><dd>Unknown</dd></div>'),
        'https://partner.gimmersta.com/products/2754'
      ),
    { code: 'UPSTREAM_UNCLASSIFIED' }
  );
});

test('Livewire login sends IDs, merges checksum deltas and reuses session for a stock page', async () => {
  const initial = {
    fingerprint: {
      id: 'fixture',
      name: 'sub-domain.partner-web.http.livewire.login',
      path: 'login',
    },
    serverMemo: {
      children: [],
      errors: [],
      htmlHash: 'h',
      data: { email: null, password: null },
      dataMeta: [],
      checksum: 'initial',
    },
  };
  const html = `<form wire:submit.prevent="attemptLogin" wire:initial-data='${JSON.stringify(initial)}'></form><script>window.livewire_token = 'csrf-fixture';</script>`;
  const calls = [];
  const fakeFetch = async (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/login') return new Response(html, { status: 200 });
    if (path.startsWith('/livewire/message/')) {
      const data = JSON.parse(options.body);
      const update = data.updates[0];
      calls.push({ type: update.type, id: update.payload.id, previous: data.serverMemo.checksum });
      assert.ok(update.payload.id);
      assert.equal(options.headers.get('X-CSRF-TOKEN'), 'csrf-fixture');
      if (calls.length === 1) {
        assert.equal(data.serverMemo.data.password, null);
        return Response.json({
          effects: {},
          serverMemo: { data: { email: 'fixture@example.com' }, checksum: 'step1' },
        });
      }
      if (calls.length === 2) {
        assert.equal(data.serverMemo.data.email, 'fixture@example.com');
        return Response.json({
          effects: {},
          serverMemo: { data: { password: 'fixture-password' }, checksum: 'step2' },
        });
      }
      assert.equal(data.serverMemo.data.email, 'fixture@example.com');
      assert.equal(data.serverMemo.data.password, 'fixture-password');
      return Response.json({
        effects: { redirect: '/dashboard' },
        serverMemo: { checksum: 'step3' },
      });
    }
    if (path === '/start') return new Response('welcome', { status: 200 });
    if (path === '/products/28350') return new Response(product('101-16', rolls), { status: 200 });
    throw new Error(`unexpected path: ${path}`);
  };
  const service = new GimmerstaService({
    email: 'fixture@example.com',
    password: 'fixture-password',
    fetchFn: fakeFetch,
  });
  const first = await service.lookup('28350');
  assert.equal(first.rolls, 685);
  assert.deepEqual(
    calls.map(({ previous }) => previous),
    ['initial', 'step1', 'step2']
  );
  assert.equal((await service.lookup('28350')).rolls, 685); // served from bounded cache
  assert.equal(calls.length, 3);
});
