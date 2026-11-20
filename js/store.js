// ============================================================================
// StokLaris AI — Ledger store: entries, stock, revenue & profit.
// Pure logic + localStorage persistence (browser). Node-safe: persistence
// functions no-op outside the browser.
// Entry: { id, date (ISO), type: 'sale'|'purchase', item, qty, unit,
//          pricePerUnit, priceTotal, category }
// ============================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StokLarisStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'stoklaris.entries.v1';

  function uid() {
    return 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  function normalizeItem(name) {
    return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function createStore(initialEntries) {
    var entries = (initialEntries || []).slice();

    function add(parsed, date) {
      var e = {
        id: uid(),
        date: (date ? new Date(date) : new Date()).toISOString(),
        type: parsed.type,
        item: normalizeItem(parsed.item),
        qty: Number(parsed.qty) || 0,
        unit: parsed.unit || 'pcs',
        pricePerUnit: parsed.pricePerUnit !== null && parsed.pricePerUnit !== undefined
          ? Number(parsed.pricePerUnit) : null,
        priceTotal: parsed.priceTotal !== null && parsed.priceTotal !== undefined
          ? Number(parsed.priceTotal) : null,
        category: parsed.category || 'Lainnya'
      };
      entries.push(e);
      return e;
    }

    function remove(id) {
      entries = entries.filter(function (e) { return e.id !== id; });
    }

    function clear() { entries = []; }

    function all() { return entries.slice(); }

    // Stock per item: purchases minus sales.
    function stockOf(item) {
      var key = normalizeItem(item);
      var s = 0;
      entries.forEach(function (e) {
        if (e.item !== key) return;
        s += (e.type === 'purchase' ? e.qty : -e.qty);
      });
      return s;
    }

    // All items currently known, with stock and prices.
    function items() {
      var map = {};
      entries.forEach(function (e) {
        if (!map[e.item]) {
          map[e.item] = { name: e.item, unit: e.unit, category: e.category, stock: 0 };
        }
      });
      Object.keys(map).forEach(function (k) { map[k].stock = stockOf(k); });
      return Object.keys(map).sort().map(function (k) { return map[k]; });
    }

    function avgPrice(item, type) {
      var key = normalizeItem(item);
      var sum = 0, qty = 0;
      entries.forEach(function (e) {
        if (e.item !== key || e.type !== type) return;
        if (e.pricePerUnit === null || e.pricePerUnit === undefined) return;
        sum += e.pricePerUnit * e.qty;
        qty += e.qty;
      });
      return qty > 0 ? sum / qty : null;
    }

    function dayRange(date) {
      var d = date ? new Date(date) : new Date();
      var start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start: start, end: end };
    }

    // Revenue, cost of goods sold and profit for one calendar day.
    // Cost uses the average purchase price; if an item was never bought
    // through the app, its cost is unknown and excluded from profit.
    function daySummary(date) {
      var range = dayRange(date);
      var revenue = 0, cogs = 0, unknownCost = 0, salesCount = 0, purchaseCount = 0;
      entries.forEach(function (e) {
        var t = new Date(e.date);
        if (t < range.start || t >= range.end) return;
        if (e.type === 'sale') {
          salesCount++;
          var sell = e.pricePerUnit !== null && e.pricePerUnit !== undefined
            ? e.pricePerUnit : avgPrice(e.item, 'sale');
          if (sell !== null && sell !== undefined) revenue += sell * e.qty;
          var buy = avgPrice(e.item, 'purchase');
          if (buy !== null) cogs += buy * e.qty;
          else unknownCost += 1;
        } else {
          purchaseCount++;
        }
      });
      return {
        revenue: Math.round(revenue),
        cogs: Math.round(cogs),
        profit: Math.round(revenue - cogs),
        unknownCostItems: unknownCost,
        salesCount: salesCount,
        purchaseCount: purchaseCount
      };
    }

    // --- Sample data (14 days, realistic warung) ---------------------------
    function seedSample(refDate) {
      var ref = refDate ? new Date(refDate) : new Date();
      function d(daysAgo, hh, mm) {
        var t = new Date(ref);
        t.setDate(t.getDate() - daysAgo);
        t.setHours(hh || 9, mm || 0, 0, 0);
        return t;
      }
      var rows = [
        // purchases (kulakan)
        ['purchase', 'gula', 5, 'kg', 13000, 14], ['purchase', 'kopi', 20, 'pcs', 1500, 14],
        ['purchase', 'indomie goreng', 40, 'pcs', 2800, 14], ['purchase', 'teh', 24, 'pcs', 1200, 14],
        ['purchase', 'aqua', 24, 'botol', 3000, 13], ['purchase', 'beras', 10, 'kg', 12000, 13],
        ['purchase', 'minyak goreng', 5, 'liter', 17000, 12], ['purchase', 'telur', 30, 'pcs', 2000, 12],
        ['purchase', 'rokok', 10, 'bungkus', 18000, 11], ['purchase', 'gula', 5, 'kg', 13000, 7],
        ['purchase', 'kopi', 20, 'pcs', 1500, 7], ['purchase', 'indomie goreng', 40, 'pcs', 2800, 7],
        ['purchase', 'aqua', 24, 'botol', 3000, 6], ['purchase', 'teh', 24, 'pcs', 1200, 5],
        ['purchase', 'kopi', 40, 'pcs', 1500, 3], ['purchase', 'telur', 30, 'pcs', 2000, 4],
        // sales — spread across 14 days so the forecaster has a real series
        ['sale', 'kopi', 4, 'pcs', 3000, 13], ['sale', 'indomie goreng', 6, 'pcs', 3500, 13],
        ['sale', 'teh', 3, 'pcs', 2500, 13], ['sale', 'gula', 1, 'kg', 16000, 13],
        ['sale', 'kopi', 5, 'pcs', 3000, 12], ['sale', 'aqua', 4, 'botol', 4000, 12],
        ['sale', 'indomie goreng', 8, 'pcs', 3500, 12], ['sale', 'telur', 6, 'pcs', 2500, 12],
        ['sale', 'kopi', 3, 'pcs', 3000, 11], ['sale', 'beras', 2, 'kg', 14000, 11],
        ['sale', 'rokok', 2, 'bungkus', 22000, 11], ['sale', 'minyak goreng', 1, 'liter', 20000, 11],
        ['sale', 'kopi', 6, 'pcs', 3000, 10], ['sale', 'indomie goreng', 5, 'pcs', 3500, 10],
        ['sale', 'teh', 4, 'pcs', 2500, 10], ['sale', 'aqua', 5, 'botol', 4000, 10],
        ['sale', 'kopi', 4, 'pcs', 3000, 9], ['sale', 'gula', 2, 'kg', 16000, 9],
        ['sale', 'telur', 8, 'pcs', 2500, 9], ['sale', 'indomie goreng', 7, 'pcs', 3500, 9],
        ['sale', 'kopi', 5, 'pcs', 3000, 8], ['sale', 'aqua', 3, 'botol', 4000, 8],
        ['sale', 'teh', 2, 'pcs', 2500, 8], ['sale', 'rokok', 1, 'bungkus', 22000, 8],
        ['sale', 'kopi', 4, 'pcs', 3000, 7], ['sale', 'indomie goreng', 6, 'pcs', 3500, 7],
        ['sale', 'beras', 1, 'kg', 14000, 7], ['sale', 'gula', 1, 'kg', 16000, 7],
        ['sale', 'kopi', 6, 'pcs', 3000, 6], ['sale', 'aqua', 6, 'botol', 4000, 6],
        ['sale', 'telur', 5, 'pcs', 2500, 6], ['sale', 'teh', 3, 'pcs', 2500, 6],
        ['sale', 'kopi', 3, 'pcs', 3000, 5], ['sale', 'indomie goreng', 9, 'pcs', 3500, 5],
        ['sale', 'minyak goreng', 1, 'liter', 20000, 5], ['sale', 'rokok', 2, 'bungkus', 22000, 5],
        ['sale', 'kopi', 5, 'pcs', 3000, 4], ['sale', 'aqua', 4, 'botol', 4000, 4],
        ['sale', 'gula', 2, 'kg', 16000, 4], ['sale', 'teh', 4, 'pcs', 2500, 4],
        ['sale', 'kopi', 4, 'pcs', 3000, 3], ['sale', 'indomie goreng', 5, 'pcs', 3500, 3],
        ['sale', 'telur', 7, 'pcs', 2500, 3], ['sale', 'beras', 2, 'kg', 14000, 3],
        ['sale', 'kopi', 5, 'pcs', 3000, 2], ['sale', 'aqua', 5, 'botol', 4000, 2],
        ['sale', 'teh', 3, 'pcs', 2500, 2], ['sale', 'rokok', 1, 'bungkus', 22000, 2],
        ['sale', 'kopi', 4, 'pcs', 3000, 1], ['sale', 'indomie goreng', 6, 'pcs', 3500, 1],
        ['sale', 'gula', 1, 'kg', 16000, 1], ['sale', 'telur', 4, 'pcs', 2500, 1],
        ['sale', 'kopi', 5, 'pcs', 3000, 0], ['sale', 'aqua', 4, 'botol', 4000, 0],
        ['sale', 'teh', 2, 'pcs', 2500, 0], ['sale', 'indomie goreng', 7, 'pcs', 3500, 0]
      ];
      rows.forEach(function (r, idx) {
        add({
          type: r[0], item: r[1], qty: r[2], unit: r[3],
          pricePerUnit: r[4], priceTotal: r[4] * r[2],
          category: 'Lainnya'
        }, d(r[5], 8 + (idx % 10), 15));
      });
      return entries.length;
    }

    // --- Persistence (browser only) -----------------------------------------
    function save() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        }
      } catch (e) { /* private mode etc. — data stays in memory */ }
    }
    function load() {
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem(STORAGE_KEY);
          if (raw) entries = JSON.parse(raw);
        }
      } catch (e) { /* corrupted data — start empty */ }
      return entries.length;
    }

    return {
      add: add, remove: remove, clear: clear, all: all,
      stockOf: stockOf, items: items, avgPrice: avgPrice,
      daySummary: daySummary, seedSample: seedSample,
      save: save, load: load, normalizeItem: normalizeItem,
      STORAGE_KEY: STORAGE_KEY
    };
  }

  return { createStore: createStore };
});
