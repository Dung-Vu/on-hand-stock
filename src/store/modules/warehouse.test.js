import test from 'node:test';
import assert from 'node:assert/strict';
import { syncArteWarehouse } from './warehouse.js';

test('Finding D: syncArteWarehouse adds Kho ARTE to both otherGroup and all for Bonario without duplicates', () => {
    const input = {
        productGroup: ['BONAP/Stock', 'O-BAP/Stock'],
        fabricGroup: ['Kho Vải'],
        otherGroup: ['Kho Khác'],
        all: ['BONAP/Stock', 'O-BAP/Stock', 'Kho Vải', 'Kho Khác'],
    };

    const synced = syncArteWarehouse(input, 'Bonario');

    // Verification 1: otherGroup has Kho ARTE
    assert.ok(synced.otherGroup.includes('Kho ARTE'));
    assert.equal(synced.otherGroup.filter((w) => w === 'Kho ARTE').length, 1);

    // Verification 2: all has Kho ARTE (fixes asymmetry where availability rejected saved/URL ARTE)
    assert.ok(synced.all.includes('Kho ARTE'));
    assert.equal(synced.all.filter((w) => w === 'Kho ARTE').length, 1);

    // Verification 3: re-syncing does not create duplicates
    const doubleSynced = syncArteWarehouse(synced, 'Bonario');
    assert.equal(doubleSynced.otherGroup.filter((w) => w === 'Kho ARTE').length, 1);
    assert.equal(doubleSynced.all.filter((w) => w === 'Kho ARTE').length, 1);
});

test('Finding D: syncArteWarehouse keeps Kho ARTE strictly absent for Ordinaire', () => {
    const inputWithArte = {
        productGroup: ['ORDAP/Stock', 'ORDHL/Stock'],
        fabricGroup: ['Kho Vải'],
        otherGroup: ['Kho ARTE', 'Other'],
        all: ['ORDAP/Stock', 'ORDHL/Stock', 'Kho Vải', 'Kho ARTE', 'Other'],
    };

    const synced = syncArteWarehouse(inputWithArte, 'Ordinaire');

    assert.ok(!synced.otherGroup.includes('Kho ARTE'));
    assert.ok(!synced.all.includes('Kho ARTE'));
    assert.ok(!synced.productGroup.includes('Kho ARTE'));
    assert.ok(!synced.fabricGroup.includes('Kho ARTE'));
});

test('Finding D: syncArteWarehouse handles array warehouse lists correctly', () => {
    const bonarioList = ['BONAP/Stock', 'Kho Vải'];
    const syncedBonario = syncArteWarehouse(bonarioList, 'Bonario');
    assert.ok(syncedBonario.includes('Kho ARTE'));
    assert.equal(syncedBonario.filter((w) => w === 'Kho ARTE').length, 1);

    const ordinaireList = ['ORDAP/Stock', 'Kho ARTE', 'Kho Vải'];
    const syncedOrdinaire = syncArteWarehouse(ordinaireList, 'Ordinaire');
    assert.ok(!syncedOrdinaire.includes('Kho ARTE'));
    assert.deepEqual(syncedOrdinaire, ['ORDAP/Stock', 'Kho Vải']);
});
