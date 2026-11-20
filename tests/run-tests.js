// StokLaris AI — test suite (Node, no dependencies).
// Run: node tests/run-tests.js
'use strict';

const NLP = require('../js/nlp.js');
const FC = require('../js/forecast.js');
const Store = require('../js/store.js');

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
function eq(a, b) { return a === b; }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps || 0.01); }

console.log('== NLP parser ==');
let p;

p = NLP.parseEntry('jual kopi 5 @3000');
check('sale kopi 5 @3000: type', p.type === 'sale', p);
check('sale kopi 5 @3000: item', p.item === 'kopi', p);
check('sale kopi 5 @3000: qty', p.qty === 5, p);
check('sale kopi 5 @3000: price/unit', p.pricePerUnit === 3000, p);
check('sale kopi 5 @3000: total', p.priceTotal === 15000, p);
check('sale kopi 5 @3000: category Minuman', p.category === 'Minuman', p);

p = NLP.parseEntry('beli gula 2kg Rp26.000');
check('buy gula 2kg Rp26.000: type', p.type === 'purchase', p);
check('buy gula 2kg Rp26.000: item', p.item === 'gula', p);
check('buy gula 2kg Rp26.000: qty+unit', p.qty === 2 && p.unit === 'kg', p);
check('buy gula 2kg Rp26.000: total 26000', p.priceTotal === 26000, p);
check('buy gula 2kg Rp26.000: per-unit 13000', p.pricePerUnit === 13000, p);
check('buy gula 2kg Rp26.000: category Sembako', p.category === 'Sembako', p);

p = NLP.parseEntry('laku indomie goreng 10');
check('laku indomie: type sale', p.type === 'sale', p);
check('laku indomie: item', p.item === 'indomie goreng', p);
check('laku indomie: qty 10', p.qty === 10, p);
check('laku indomie: no price', p.pricePerUnit === null, p);
check('laku indomie: category Makanan', p.category === 'Makanan', p);

p = NLP.parseEntry('jual aqua 4 16000');
check('bare trailing number = total', p.priceTotal === 16000 && p.pricePerUnit === 4000, p);

p = NLP.parseEntry('beli beras 5 kg');
check('beli beras 5 kg: qty+unit split', p.qty === 5 && p.unit === 'kg', p);
check('beli beras 5 kg: no price', p.priceTotal === null, p);

p = NLP.parseEntry('jual rokok 2 bungkus harga 22000');
check('harga keyword: per-unit', p.pricePerUnit === 22000, p);
check('rokok category', p.category === 'Rokok', p);

p = NLP.parseEntry('kopi 3');
check('no type word defaults to sale', p.type === 'sale', p);
check('kopi 3: item+qty', p.item === 'kopi' && p.qty === 3, p);

p = NLP.parseEntry('jual teh botol 6 @2500');
check('multi-word item: teh botol', p.item === 'teh botol', p);
check('teh botol category Minuman', p.category === 'Minuman', p);

p = NLP.parseEntry('beli minyak goreng 2 liter 34000');
check('minyak goreng 2 liter', p.item === 'minyak goreng' && p.qty === 2 && p.unit === 'liter', p);
check('minyak goreng category Sembako', p.category === 'Sembako', p);

p = NLP.parseEntry('jual sabun 3 @5000');
check('sabun category Kebutuhan Harian', p.category === 'Kebutuhan Harian', p);

p = NLP.parseEntry('jual barang aneh xyz 2 @1000');
check('unknown item -> Lainnya', p.category === 'Lainnya', p);

check('parseNumberToken 26.000', NLP.parseNumberToken('26.000') === 26000);
check('parseNumberToken 2,5', NLP.parseNumberToken('2,5') === 2.5);
check('parseNumberToken 3000', NLP.parseNumberToken('3000') === 3000);

console.log('== Forecast (exponential smoothing) ==');
check('smooth flat series', approx(FC.smooth([{ qty: 5 }, { qty: 5 }, { qty: 5 }]), 5));
check('smooth rising series weights recent', FC.smooth([{ qty: 0 }, { qty: 10 }]) > 0 && FC.smooth([{ qty: 0 }, { qty: 10 }]) < 10);
check('smooth empty series = 0', FC.smooth([]) === 0);

const entries = [];
for (let i = 13; i >= 0; i--) {
  const d = new Date(); d.setDate(d.getDate() - i);
  entries.push({ date: d.toISOString(), type: 'sale', item: 'kopi', qty: 5 });
}
let f = FC.forecast('kopi', entries, 10, new Date());
check('forecast steady 5/day, stock 10 -> ~2 days', approx(f.daysLeft, 2, 0.5), f);
check('forecast steady 5/day -> menipis', f.status === 'menipis', f);
check('forecast reorder covers 7 days', f.reorderQty === 35, f);

f = FC.forecast('kopi', entries, 100, new Date());
check('forecast stock 100 -> aman', f.status === 'aman', f);

f = FC.forecast('kopi', entries, 0, new Date());
check('forecast stock 0 -> habis', f.status === 'habis', f);

f = FC.forecast('teh', entries, 10, new Date());
check('forecast no sales history -> no-sales', f.status === 'no-sales' && f.dailyDemand === 0, f);

console.log('== Store: stock & profit ==');
const store = Store.createStore();
store.add({ type: 'purchase', item: 'kopi', qty: 20, unit: 'pcs', pricePerUnit: 1500, priceTotal: 30000, category: 'Minuman' }, new Date());
store.add({ type: 'sale', item: 'kopi', qty: 5, unit: 'pcs', pricePerUnit: 3000, priceTotal: 15000, category: 'Minuman' }, new Date());
check('stock after buy 20 sell 5 = 15', store.stockOf('kopi') === 15);
check('avg buy price 1500', store.avgPrice('kopi', 'purchase') === 1500);
const sum = store.daySummary(new Date());
check('day revenue 15000', sum.revenue === 15000, sum);
check('day profit 7500 (15000 - 5x1500)', sum.profit === 7500, sum);

const store2 = Store.createStore();
store2.seedSample(new Date());
check('seeded sample has entries', store2.all().length > 50, store2.all().length);
check('seeded kopi stock positive', store2.stockOf('kopi') > 0, store2.stockOf('kopi'));
const items2 = store2.items();
check('seeded items list non-empty', items2.length >= 8, items2.length);
const fcAll = FC.forecastAll(items2, store2.all(), new Date());
check('forecastAll covers all items', fcAll.length === items2.length);
check('at least one forecast has demand > 0', fcAll.some(x => x.dailyDemand > 0));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
