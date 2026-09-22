import test from 'node:test';
import assert from 'node:assert/strict';
import * as redis from './redis.js';

test('Memory store enforces hard cap and never exceeds limit', async () => {
    const prevCap = redis._setMaxMemoryKeysForTest(5);
    await redis.flushAll();

    try {
        for (let i = 1; i <= 15; i++) {
            await redis.set(`cap-test-${i}`, { index: i }, 60);
        }

        const size = redis._getMemorySize();
        assert.equal(size, 5, `Store size should be exactly 5, got ${size}`);

        // Ensure the latest 5 items are in store
        for (let i = 11; i <= 15; i++) {
            const val = await redis.get(`cap-test-${i}`);
            assert.ok(val, `Recent item cap-test-${i} should be present`);
            assert.equal(val.index, i);
        }

        // Ensure older items were evicted
        for (let i = 1; i <= 10; i++) {
            const val = await redis.get(`cap-test-${i}`);
            assert.equal(val, null, `Older item cap-test-${i} should be evicted`);
        }
    } finally {
        await redis.flushAll();
        redis._setMaxMemoryKeysForTest(prevCap);
    }
});

test('Hot entry survives cold eviction via LRU recency refresh', async () => {
    const prevCap = redis._setMaxMemoryKeysForTest(3);
    await redis.flushAll();

    try {
        // Insert key1, key2, key3
        await redis.set('key1', 'val1', 60);
        await redis.set('key2', 'val2', 60);
        await redis.set('key3', 'val3', 60);

        // Access key1 to make it hot (most recently used)
        const hit1 = await redis.get('key1');
        assert.equal(hit1, 'val1');

        // Insert cold key4 -> capacity exceeded -> oldest unaccessed entry (key2) should be evicted
        await redis.set('key4', 'val4', 60);

        assert.equal(redis._getMemorySize(), 3);
        assert.equal(await redis.get('key1'), 'val1', 'Hot key1 must survive cold eviction');
        assert.equal(await redis.get('key2'), null, 'Cold key2 should have been evicted');
        assert.equal(await redis.get('key3'), 'val3');
        assert.equal(await redis.get('key4'), 'val4');

        // Access key1 again
        await redis.get('key1');

        // Insert cold key5 -> oldest (key3) should be evicted
        await redis.set('key5', 'val5', 60);

        assert.equal(redis._getMemorySize(), 3);
        assert.equal(await redis.get('key1'), 'val1', 'Hot key1 must still survive');
        assert.equal(await redis.get('key3'), null, 'Cold key3 should have been evicted');
        assert.equal(await redis.get('key4'), 'val4');
        assert.equal(await redis.get('key5'), 'val5');
    } finally {
        await redis.flushAll();
        redis._setMaxMemoryKeysForTest(prevCap);
    }
});

test('Stale behavior is preserved for remaining entries within stale window', async () => {
    await redis.flushAll();

    try {
        // Write item with 1 second TTL
        await redis.set('stale-item', { data: 'old-payload' }, 1);

        // Immediately available via get
        assert.deepEqual(await redis.get('stale-item'), { data: 'old-payload' });

        // Wait 1.1 seconds for TTL to expire
        await new Promise((resolve) => setTimeout(resolve, 1100));

        // Fresh get returns null
        assert.equal(await redis.get('stale-item'), null);

        // Stale get returns the cached item (within 30m stale window)
        assert.deepEqual(await redis.getStale('stale-item'), { data: 'old-payload' });
    } finally {
        await redis.flushAll();
    }
});
