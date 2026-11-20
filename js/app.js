// ============================================================================
// StokLaris AI — Browser UI wiring. No build step, no framework.
// ============================================================================
(function () {
  'use strict';

  var NLP = window.StokLarisNLP;
  var FC = window.StokLarisForecast;
  var Store = window.StokLarisStore;

  var store = Store.createStore();
  var EXAMPLES = [
    'jual kopi 5 @3000',
    'beli gula 2kg Rp26.000',
    'laku indomie goreng 10',
    'jual aqua 4 16000',
    'beli beras 5 kg'
  ];

  function $(id) { return document.getElementById(id); }
  function rp(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var lastParsed = null;

  function renderPreview() {
    var text = $('input-text').value.trim();
    var box = $('parse-preview');
    if (!text) { box.classList.add('hidden'); lastParsed = null; return; }
    var p = NLP.parseEntry(text);
    lastParsed = p;
    var ok = p.item && p.qty !== null;
    box.classList.remove('hidden');
    box.innerHTML =
      '<div class="preview-title">🤖 AI memahami:</div>' +
      '<div class="preview-grid">' +
      '<span>Jenis</span><b>' + (p.type === 'sale' ? 'Penjualan' : 'Pembelian') + '</b>' +
      '<span>Barang</span><b>' + (p.item ? esc(p.item) : '<i class="warn">tidak dikenali</i>') + '</b>' +
      '<span>Jumlah</span><b>' + (p.qty !== null ? p.qty + ' ' + esc(p.unit) : '<i class="warn">tidak disebut</i>') + '</b>' +
      '<span>Harga</span><b>' + (p.pricePerUnit !== null ? rp(p.pricePerUnit) + '/' + esc(p.unit) : '<i>belum disebut</i>') + '</b>' +
      '<span>Kategori</span><b>' + esc(p.category) + '</b>' +
      '</div>' +
      '<div class="preview-note">' + esc(NLP.explain(p)) + '</div>';
    $('btn-save').disabled = !ok;
  }

  function renderDashboard() {
    var today = store.daySummary(new Date());
    $('stat-revenue').textContent = rp(today.revenue);
    $('stat-profit').textContent = rp(today.profit);
    $('stat-sales').textContent = today.salesCount + ' penjualan';
    $('stat-unknown').textContent = today.unknownCostItems > 0
      ? today.unknownCostItems + ' item tanpa harga beli — laba belum penuh'
      : 'Semua laba terhitung dari harga beli';

    var items = store.items();
    var forecasts = FC.forecastAll(items, store.all(), new Date());
    var alerts = forecasts.filter(function (f) {
      return f.status === 'habis' || f.status === 'menipis' || f.status === 'waspada';
    });
    var alertBox = $('alerts');
    if (alerts.length === 0) {
      alertBox.innerHTML = '<div class="alert ok">✅ Semua stok aman untuk 7 hari ke depan.</div>';
    } else {
      alertBox.innerHTML = alerts.map(function (f) {
        var icon = f.status === 'habis' ? '🔴' : f.status === 'menipis' ? '🟠' : '🟡';
        var msg = f.status === 'habis'
          ? 'Stok habis! Saran pesan: ' + f.reorderQty + ' ' + esc(items.find(function (i) { return i.name === f.item; }).unit || 'pcs')
          : 'Habis dalam ±' + f.daysLeft + ' hari (' + f.stockoutDate + '). Saran pesan: ' + f.reorderQty;
        return '<div class="alert ' + f.status + '">' + icon + ' <b>' + esc(f.item) + '</b> — ' + msg + '</div>';
      }).join('');
    }

    var rows = forecasts.map(function (f) {
      var it = items.find(function (i) { return i.name === f.item; });
      var badge = { habis: '🔴 Habis', menipis: '🟠 Menipis', waspada: '🟡 Waspada', aman: '🟢 Aman', 'no-sales': '⚪ Baru' }[f.status];
      return '<tr><td><b>' + esc(f.item) + '</b><br><small>' + esc(it.category) + '</small></td>' +
        '<td>' + f.stock + ' ' + esc(it.unit) + '</td>' +
        '<td>' + (f.dailyDemand > 0 ? f.dailyDemand + '/hari' : '—') + '</td>' +
        '<td>' + (f.daysLeft !== null ? '±' + f.daysLeft + ' hari' : '—') + '</td>' +
        '<td>' + badge + '</td></tr>';
    }).join('');
    $('stock-body').innerHTML = rows || '<tr><td colspan="5">Belum ada barang. Coba muat data contoh di bawah.</td></tr>';

    var history = store.all().slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    }).slice(0, 12);
    $('history-body').innerHTML = history.map(function (e) {
      var d = new Date(e.date);
      var dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) +
        ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return '<tr><td>' + dateStr + '</td><td>' + (e.type === 'sale' ? '🔻 Jual' : '🔺 Beli') + '</td>' +
        '<td><b>' + esc(e.item) + '</b></td><td>' + e.qty + ' ' + esc(e.unit) + '</td>' +
        '<td>' + (e.pricePerUnit !== null ? rp(e.pricePerUnit) : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="5">Belum ada catatan.</td></tr>';
  }

  function saveEntry() {
    if (!lastParsed || !lastParsed.item || lastParsed.qty === null) return;
    store.add(lastParsed, new Date());
    store.save();
    $('input-text').value = '';
    renderPreview();
    renderDashboard();
  }

  function seedDemo() {
    store.clear();
    store.seedSample(new Date());
    // Re-categorize seeded items with the NLP classifier.
    store.all().forEach(function (e) {
      e.category = NLP.categorize(e.item).category;
    });
    store.save();
    renderDashboard();
  }

  function clearAll() {
    if (!confirm('Hapus semua catatan?')) return;
    store.clear();
    store.save();
    renderDashboard();
  }

  function init() {
    store.load();
    if (store.all().length === 0) seedDemo();
    else renderDashboard();

    $('input-text').addEventListener('input', renderPreview);
    $('input-text').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); saveEntry(); }
    });
    $('btn-save').addEventListener('click', saveEntry);
    $('btn-seed').addEventListener('click', seedDemo);
    $('btn-clear').addEventListener('click', clearAll);

    var chips = $('examples');
    EXAMPLES.forEach(function (ex) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = ex;
      b.addEventListener('click', function () {
        $('input-text').value = ex;
        renderPreview();
        $('input-text').focus();
      });
      chips.appendChild(b);
    });

    // Deep-link demo: index.html#coba=jual%20kopi%205%20%403000
    // prefills the input and shows the AI parse preview immediately.
    var demo = /#coba=(.+)/.exec(window.location.hash || '');
    if (demo) {
      try {
        $('input-text').value = decodeURIComponent(demo[1]);
        renderPreview();
      } catch (e) { /* bad hash — ignore */ }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
