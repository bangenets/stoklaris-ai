// ============================================================================
// StokLaris AI — On-device NLP parser + Naive Bayes item categorizer.
// No server, no API key, no data leaves the device.
// Works in the browser (globalThis.StokLarisNLP) and in Node (module.exports).
// ============================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StokLarisNLP = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- Vocabulary -----------------------------------------------------------
  var SALE_WORDS = ['jual', 'terjual', 'laku', 'keluar', 'sold'];
  var BUY_WORDS = ['beli', 'kulak', 'masuk', 'restok', 'restock', 'belanja', 'kulakan'];
  var UNITS = [
    'kilogram', 'kg', 'gram', 'g', 'liter', 'ltr', 'l', 'ml',
    'pcs', 'bungkus', 'botol', 'dus', 'renceng', 'sachet', 'pack',
    'karung', 'kaleng', 'porsi', 'ikat', 'lembar', 'buah', 'batang', 'slop'
  ];
  var FILLER_WORDS = ['harga', 'rp', 'rupiah', 'seharga', 'per', 'satu', 'ya', 'dong'];

  // Naive Bayes-ish keyword weights per category (built-in training set).
  // Score = 1 (Laplace prior) + sum of matched keyword weights.
  var CATEGORY_KEYWORDS = {
    'Minuman': {
      kopi: 5, teh: 5, aqua: 6, susu: 5, jus: 5, sirup: 5, es: 3,
      coklat: 3, 'air mineral': 6, 'air-mineral': 6, sprite: 5, fanta: 5,
      'teh botol': 6, 'kopi susu': 6, matcha: 4, energen: 4, milo: 5,
      yakult: 5, 'pocari': 5, 'air kelapa': 5
    },
    'Makanan': {
      indomie: 6, mie: 5, roti: 5, biskuit: 5, kerupuk: 4, 'mie goreng': 6,
      'mie rebus': 6, nasi: 4, gorengan: 4, tempe: 4, tahu: 4, bakso: 5,
      sosis: 4, nugget: 4, cokelat: 3, permen: 4, wafer: 4, chiki: 4,
      'mie instan': 6, sarden: 4, kornet: 4, abon: 4
    },
    'Rokok': {
      rokok: 8, gudang: 5, garam: 4, sampoerna: 6, djarum: 6, kretek: 6,
      filter: 3, mild: 4, menthol: 4, surya: 5, 'esse': 4, marlboro: 6
    },
    'Sembako': {
      gula: 6, beras: 6, minyak: 6, telur: 6, garam: 5, tepung: 5,
      'minyak goreng': 7, bawang: 4, cabai: 4, cabe: 4, 'gula pasir': 7,
      terigu: 5, 'beras premium': 6, 'telur ayam': 6, kecap: 4, saos: 4,
      saus: 4, 'santan': 4, 'kopi bubuk': 3
    },
    'Kebutuhan Harian': {
      sabun: 6, sampo: 6, shampoo: 6, pasta: 4, 'pasta gigi': 6,
      sikat: 3, 'sikat gigi': 6, deterjen: 6, rinso: 6, pewangi: 4,
      tisu: 5, tissue: 5, pembalut: 6, 'minyak kayu putih': 5,
      'obat nyamuk': 5, baterai: 4, korek: 4, 'air isi ulang': 3
    }
  };
  var CATEGORY_NAMES = Object.keys(CATEGORY_KEYWORDS);

  // --- Number handling (Indonesian formats) --------------------------------
  // "26.000" -> 26000 (thousand separator), "2,5" -> 2.5, "3000" -> 3000.
  function parseNumberToken(tok) {
    var s = String(tok).replace(/[^0-9.,]/g, '');
    if (!s) return null;
    if (s.indexOf(',') !== -1) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+(\.\d+)?$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  function splitGluedQtyUnit(tok) {
    // "2kg", "500g", "1.5liter" -> { qty, unit } ; "3000" -> { qty: 3000 }
    var m = /^(\d+(?:[.,]\d+)?)([a-z]+)?$/.exec(tok.toLowerCase());
    if (!m) return null;
    var qty = parseNumberToken(m[1]);
    if (qty === null) return null;
    var unit = m[2] || null;
    if (unit && UNITS.indexOf(unit) === -1) return { qty: qty, unit: null, bare: true };
    return { qty: qty, unit: unit, bare: !unit };
  }

  function tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[@]/g, ' @ ')
      .replace(/,/g, ' , ')
      .trim()
      .split(/\s+/)
      .filter(function (t) { return t.length > 0; });
  }

  // --- Main parser ----------------------------------------------------------
  // Supported formats (documented in README):
  //   "jual kopi 5 @3000"        -> sale, kopi, 5 pcs, Rp3.000/satuan
  //   "jual kopi 5 15000"        -> sale, kopi, 5 pcs, total Rp15.000
  //   "beli gula 2kg Rp26.000"   -> purchase, gula, 2 kg, Rp26.000 total
  //   "laku indomie goreng 10"   -> sale, indomie goreng, 10 pcs, harga ?
  //   "beli beras 5 kg"          -> purchase, beras, 5 kg, harga ?
  function parseEntry(text) {
    var raw = String(text || '').trim();
    var tokens = tokenize(raw);
    var used = {}; // token index -> reason it was consumed
    var type = 'sale';
    var qty = null, unit = null, pricePerUnit = null, priceTotal = null;

    // 1) Transaction type: first type-word wins; default is sale.
    for (var i = 0; i < tokens.length; i++) {
      if (SALE_WORDS.indexOf(tokens[i]) !== -1) { type = 'sale'; used[i] = 'type'; break; }
      if (BUY_WORDS.indexOf(tokens[i]) !== -1) { type = 'purchase'; used[i] = 'type'; break; }
    }

    // 2) Price via "@3000" (per-unit) or "rp26.000" / "rp 26000" (total).
    for (var j = 0; j < tokens.length; j++) {
      if (used[j]) continue;
      if (tokens[j] === '@' && j + 1 < tokens.length) {
        var p1 = parseNumberToken(tokens[j + 1]);
        if (p1 !== null) { pricePerUnit = p1; used[j] = 'price'; used[j + 1] = 'price'; }
      } else if (/^@\d/.test(tokens[j])) {
        var p2 = parseNumberToken(tokens[j].slice(1));
        if (p2 !== null) { pricePerUnit = p2; used[j] = 'price'; }
      } else if (/^rp\d/.test(tokens[j])) {
        var p3 = parseNumberToken(tokens[j].slice(2));
        if (p3 !== null) { priceTotal = p3; used[j] = 'price'; }
      } else if (tokens[j] === 'rp' && j + 1 < tokens.length) {
        var p4 = parseNumberToken(tokens[j + 1]);
        if (p4 !== null) { priceTotal = p4; used[j] = 'price'; used[j + 1] = 'price'; }
      } else if (tokens[j] === 'harga' && j + 1 < tokens.length) {
        var p5 = parseNumberToken(tokens[j + 1]);
        if (p5 !== null) { pricePerUnit = p5; used[j] = 'price'; used[j + 1] = 'price'; }
      }
    }

    // 3) Quantity: first number token (glued "2kg" counts), plus its unit.
    for (var k = 0; k < tokens.length; k++) {
      if (used[k]) continue;
      var g = splitGluedQtyUnit(tokens[k]);
      if (g) {
        qty = g.qty;
        used[k] = 'qty';
        if (g.unit) { unit = g.unit; }
        else if (k + 1 < tokens.length && UNITS.indexOf(tokens[k + 1]) !== -1) {
          unit = tokens[k + 1]; used[k + 1] = 'unit';
        }
        break;
      }
      // "5x" / "x5" forms
      var xm = /^(\d+(?:[.,]\d+)?)x$/.exec(tokens[k]) || /^x(\d+(?:[.,]\d+)?)$/.exec(tokens[k]);
      if (xm) {
        qty = parseNumberToken(xm[1]);
        used[k] = 'qty';
        break;
      }
    }

    // 4) Bare trailing number = total price (only if qty found and no price yet).
    if (qty !== null && pricePerUnit === null && priceTotal === null && tokens.length > 0) {
      var last = tokens.length - 1;
      if (!used[last]) {
        var pt = parseNumberToken(tokens[last]);
        if (pt !== null) { priceTotal = pt; used[last] = 'price'; }
      }
    }

    // 5) Item name = whatever is left, minus filler words.
    var itemParts = [];
    for (var m = 0; m < tokens.length; m++) {
      if (used[m]) continue;
      if (FILLER_WORDS.indexOf(tokens[m]) !== -1) continue;
      if (tokens[m] === ',') continue;
      itemParts.push(tokens[m]);
    }
    var item = itemParts.join(' ').replace(/\s+/g, ' ').trim();

    // 6) Normalize price fields.
    if (priceTotal !== null && pricePerUnit === null && qty) {
      pricePerUnit = priceTotal / qty;
    }
    if (pricePerUnit !== null && priceTotal === null && qty) {
      priceTotal = pricePerUnit * qty;
    }
    if (!unit) unit = 'pcs';

    // 7) Confidence: how much did we understand?
    var confidence = 0;
    if (item) confidence += 0.5;
    if (qty !== null) confidence += 0.3;
    if (pricePerUnit !== null) confidence += 0.2;

    var result = {
      raw: raw,
      type: type,
      item: item,
      qty: qty,
      unit: unit,
      pricePerUnit: pricePerUnit,
      priceTotal: priceTotal,
      confidence: Math.round(confidence * 100) / 100
    };
    if (item) {
      var cat = categorize(item);
      result.category = cat.category;
      result.categoryConfidence = cat.confidence;
    } else {
      result.category = 'Lainnya';
      result.categoryConfidence = 0;
    }
    return result;
  }

  // --- Naive Bayes categorizer ----------------------------------------------
  function categorize(itemName) {
    var text = ' ' + String(itemName || '').toLowerCase() + ' ';
    var scores = {};
    var total = 0;
    CATEGORY_NAMES.forEach(function (cat) {
      var score = 1; // Laplace prior
      var keywords = CATEGORY_KEYWORDS[cat];
      Object.keys(keywords).forEach(function (kw) {
        if (text.indexOf(kw) !== -1) score += keywords[kw];
      });
      scores[cat] = score;
      total += score;
    });
    var best = 'Lainnya', bestScore = 0;
    CATEGORY_NAMES.forEach(function (cat) {
      if (scores[cat] > bestScore) { bestScore = scores[cat]; best = cat; }
    });
    // No keyword matched at all -> Lainnya (prior-only tie means "unknown").
    var matched = bestScore > 1;
    return {
      category: matched ? best : 'Lainnya',
      confidence: matched ? Math.round((bestScore / total) * 100) / 100 : 0,
      scores: scores
    };
  }

  function explain(parsed) {
    var bits = [];
    bits.push(parsed.type === 'sale' ? 'Penjualan' : 'Pembelian');
    if (parsed.item) bits.push('barang: ' + parsed.item);
    if (parsed.qty !== null) bits.push('jumlah: ' + parsed.qty + ' ' + parsed.unit);
    if (parsed.pricePerUnit !== null) {
      bits.push('harga: Rp' + Math.round(parsed.pricePerUnit).toLocaleString('id-ID') + '/' + parsed.unit);
    } else {
      bits.push('harga: belum disebut');
    }
    bits.push('kategori: ' + parsed.category);
    return bits.join(' | ');
  }

  return {
    parseEntry: parseEntry,
    categorize: categorize,
    explain: explain,
    parseNumberToken: parseNumberToken,
    CATEGORY_NAMES: CATEGORY_NAMES.concat(['Lainnya'])
  };
});
