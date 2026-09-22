import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
    cacheMiddleware,
    trySendStaleCache,
    getCacheKey,
    _getInflightSize,
    IS_STALE_RESPONSE,
} from './cache.js';
import * as redis from '../services/redis.js';

function createMockReq(url, query = {}) {
    const emitter = new EventEmitter();
    emitter.method = 'GET';
    emitter.url = url;
    emitter.originalUrl = url;
    emitter.query = query;
    return emitter;
}

function createMockRes() {
    const emitter = new EventEmitter();
    const headers = new Map();
    emitter.statusCode = 200;
    emitter.headersSent = false;
    emitter.writableEnded = false;

    emitter.setHeader = (key, val) => {
        headers.set(key.toLowerCase(), String(val));
    };
    emitter.getHeader = (key) => {
        return headers.get(key.toLowerCase());
    };
    emitter.status = (code) => {
        emitter.statusCode = code;
        return emitter;
    };
    emitter.json = (data) => {
        emitter.sentBody = data;
        emitter.writableEnded = true;
        emitter.emit('finish');
        return emitter;
    };
    return emitter;
}

test('getCacheKey normalizes query params and strips cache busters while preserving locationIds', () => {
    const req1 = createMockReq('/api/stock?locationIds=165,328&_t=123456&timestamp=9999');
    const key1 = getCacheKey(req1);

    const req2 = createMockReq('/api/stock?_t=789012&locationIds=165,328');
    const key2 = getCacheKey(req2);

    assert.equal(key1, key2, 'Cache keys must match despite different cache-buster query params');
    assert.ok(key1.includes('locationIds=165%2C328') || key1.includes('locationIds=165,328'));
    assert.ok(!key1.includes('_t='));
    assert.ok(!key1.includes('timestamp='));
});

test('Finding A: trySendStaleCache preserves X-Cache: STALE and does not recache stale data as fresh', async () => {
    await redis.flushAll();

    const cacheKey = 'api:/api/stock?locationIds=165';
    const stalePayload = { success: true, data: [{ id: 1, name: 'Stale Product' }] };

    // Seed expired entry in redis memory cache (TTL expired, within stale window)
    await redis.set(cacheKey, stalePayload, 1);
    await new Promise((r) => setTimeout(r, 1100)); // wait for fresh TTL to expire

    // Verify fresh get returns null but stale returns stalePayload
    assert.equal(await redis.get(cacheKey), null);
    assert.deepEqual(await redis.getStale(cacheKey), stalePayload);

    const mw = cacheMiddleware(300);
    const req = createMockReq('/api/stock?locationIds=165');
    const res = createMockRes();

    let nextCalled = false;
    await mw(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true, 'Cache miss should call next');

    // Simulate upstream Odoo failure where trySendStaleCache is called
    const sentStale = await trySendStaleCache(req, res);
    assert.equal(sentStale, true, 'trySendStaleCache should report success');

    // Verification 1: Header must be STALE, not overwritten by MISS
    assert.equal(res.getHeader('x-cache'), 'STALE');

    // Verification 2: Stale payload must not leak internal marker to body
    assert.deepEqual(res.sentBody, stalePayload);
    assert.equal(res.sentBody[IS_STALE_RESPONSE], undefined);
    assert.equal(res.sentBody._isStaleResponse, undefined);

    // Verification 3: Stale response must NOT enter normal success cache write (redis.get must still be null!)
    const freshInRedis = await redis.get(cacheKey);
    assert.equal(freshInRedis, null, 'Stale response must NEVER be recached with a fresh TTL');

    await redis.flushAll();
});

test('Finding B: normal request close event does not cancel an active response', async () => {
    await redis.flushAll();

    const mw = cacheMiddleware(300, { timeoutMs: 5000 });
    const reqLeader = createMockReq('/api/stock?locationIds=199');
    const resLeader = createMockRes();

    await mw(reqLeader, resLeader, () => {});
    assert.equal(_getInflightSize(), 1);

    // Modern Node emits request "close" after the request body completes normally.
    reqLeader.emit('close');
    assert.equal(_getInflightSize(), 1, 'Normal request close must not reject the response leader');

    resLeader.json({ success: true, data: [] });
    assert.equal(_getInflightSize(), 0);
    await redis.flushAll();
});

test('Finding B: inflight entry settles and cleans up on client close-before-finish without hanging waiters', async () => {
    await redis.flushAll();

    const mw = cacheMiddleware(300, { timeoutMs: 5000 });
    const reqLeader = createMockReq('/api/stock?locationIds=200');
    const resLeader = createMockRes();

    let leaderNext = false;
    await mw(reqLeader, resLeader, () => {
        leaderNext = true;
    });
    assert.equal(leaderNext, true);
    assert.equal(_getInflightSize(), 1, 'Inflight map should have 1 active leader');

    // Waiter arrives while leader is still in flight
    const reqWaiter = createMockReq('/api/stock?locationIds=200');
    const resWaiter = createMockRes();
    const waiterPromise = mw(reqWaiter, resWaiter, () => {
        assert.fail('Waiter should not execute upstream handler');
    });

    // Client abruptly closes connection before leader finishes
    resLeader.emit('close');

    // Await waiter completion — waiter must not hang forever
    await waiterPromise;

    // Verify cleanup
    assert.equal(_getInflightSize(), 0, 'Inflight entry must be removed on close');
    assert.equal(resWaiter.getHeader('x-cache'), 'FAILURE');
    assert.equal(resWaiter.statusCode, 503);
    assert.equal(resWaiter.sentBody.success, false);

    await redis.flushAll();
});

test('Finding B: leader failure propagates controlled failure and avoids concurrent waiter stampede', async () => {
    await redis.flushAll();

    const mw = cacheMiddleware(300);
    const reqLeader = createMockReq('/api/stock?locationIds=300');
    const resLeader = createMockRes();

    let upstreamCalls = 0;
    await mw(reqLeader, resLeader, () => {
        upstreamCalls++;
    });

    // Spawn 3 concurrent waiters
    const waiters = [1, 2, 3].map(() => {
        const req = createMockReq('/api/stock?locationIds=300');
        const res = createMockRes();
        const promise = mw(req, res, () => {
            upstreamCalls++;
        });
        return { req, res, promise };
    });

    assert.equal(upstreamCalls, 1, 'Only leader should have hit upstream so far');

    // Leader finishes with error (status 500, success: false)
    resLeader.status(500).json({ success: false, error: 'Odoo connection crashed', code: 'ODOO_ERROR' });

    // Wait for all waiters to complete
    await Promise.all(waiters.map((w) => w.promise));

    // Assert NO waiter stampeded upstream
    assert.equal(upstreamCalls, 1, 'Waiters must NOT stampede upstream on leader failure');

    // Assert each waiter received controlled failure
    for (const w of waiters) {
        assert.equal(w.res.getHeader('x-cache'), 'FAILURE');
        assert.equal(w.res.statusCode, 500);
        assert.equal(w.res.sentBody.success, false);
        assert.equal(w.res.sentBody.code, 'ODOO_ERROR');
    }

    assert.equal(_getInflightSize(), 0, 'Inflight entry must be cleaned up');
    await redis.flushAll();
});

test('Finding B: inflight entry cleans up on bounded timeout and frees waiters', async () => {
    await redis.flushAll();

    // Set 50ms timeout for test
    const mw = cacheMiddleware(300, { timeoutMs: 50 });
    const reqLeader = createMockReq('/api/stock?locationIds=400');
    const resLeader = createMockRes();

    await mw(reqLeader, resLeader, () => {
        // Leader hangs and never finishes
    });
    assert.equal(_getInflightSize(), 1);

    const reqWaiter = createMockReq('/api/stock?locationIds=400');
    const resWaiter = createMockRes();
    const waiterPromise = mw(reqWaiter, resWaiter, () => {});

    await waiterPromise;

    assert.equal(_getInflightSize(), 0, 'Inflight map must clear on timeout');
    assert.equal(resWaiter.getHeader('x-cache'), 'FAILURE');
    assert.equal(resWaiter.statusCode, 503);

    await redis.flushAll();
});
