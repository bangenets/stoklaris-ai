// ============================================================================
// StokLaris AI — Demand forecasting with exponential smoothing.
// Pure functions, no I/O. Works in the browser and in Node.
// Model: single exponential smoothing (alpha = 0.3) over daily sold quantities,
// then days-until-stockout = currentStock / smoothedDailyDemand.
// ============================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StokLarisForecast = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ALPHA = 0.3;          // smoothing factor (0..1); 0.3 = steady, not jumpy
  var LOOKBACK_DAYS = 14;   // how many days of sales history to use
  var COVER_DAYS = 7;       // reorder suggestion covers this many days of demand
  var LOW_DAYS = 3;         // "menipis" threshold
  var WARN_DAYS = 7;        // "waspada" threshold

  function dayKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    return d.toISOString().slice(0, 10);
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  // Aggregate sold quantities per day for one item over the lookback window.
  // entries: [{ date, type: 'sale'|'purchase', item, qty }]
  // refDate: "today" (Date or ISO string). Returns array of { date, qty }.
  function dailySalesSeries(item, entries, refDate, days) {
    days = days || LOOKBACK_DAYS;
    var ref = refDate ? new Date(refDate) : new Date();
    var byDay = {};
    entries.forEach(function (e) {
      if (e.type !== 'sale') return;
      if (String(e.item).toLowerCase() !== String(item).toLowerCase()) return;
      var k = dayKey(e.date);
      byDay[k] = (byDay[k] || 0) + (Number(e.qty) || 0);
    });
    var series = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = addDays(ref, -i);
      var k = dayKey(d);
      series.push({ date: k, qty: byDay[k] || 0 });
    }
    return series;
  }

  // Single exponential smoothing. Returns the smoothed level (avg daily demand).
  function smooth(series, alpha) {
    alpha = (alpha === undefined) ? ALPHA : alpha;
    if (!series || series.length === 0) return 0;
    var level = series[0].qty;
    for (var i = 1; i < series.length; i++) {
      level = alpha * series[i].qty + (1 - alpha) * level;
    }
    return level;
  }

  // Full forecast for one item.
  // Returns: { item, stock, dailyDemand, daysLeft, stockoutDate, reorderQty,
  //            status, series }
  // status: 'habis' | 'menipis' | 'waspada' | 'aman' | 'no-sales'
  function forecast(item, entries, stock, refDate) {
    var series = dailySalesSeries(item, entries, refDate);
    var demand = smooth(series);
    var s = Math.max(0, Number(stock) || 0);
    var result = {
      item: item,
      stock: s,
      dailyDemand: Math.round(demand * 100) / 100,
      daysLeft: null,
      stockoutDate: null,
      reorderQty: 0,
      status: 'no-sales',
      series: series
    };
    if (s <= 0) {
      result.status = 'habis';
      result.daysLeft = 0;
      result.reorderQty = Math.ceil(demand * COVER_DAYS) || 0;
      return result;
    }
    if (demand <= 0) return result; // sold nothing in 14 days: no forecast
    var daysLeft = s / demand;
    result.daysLeft = Math.round(daysLeft * 10) / 10;
    var out = addDays(refDate ? new Date(refDate) : new Date(), Math.floor(daysLeft));
    result.stockoutDate = dayKey(out);
    if (daysLeft <= LOW_DAYS) {
      result.status = 'menipis';
      result.reorderQty = Math.ceil(demand * COVER_DAYS);
    } else if (daysLeft <= WARN_DAYS) {
      result.status = 'waspada';
      result.reorderQty = Math.ceil(demand * COVER_DAYS);
    } else {
      result.status = 'aman';
    }
    return result;
  }

  // Forecast for every stocked item.
  function forecastAll(items, entries, refDate) {
    return items.map(function (it) {
      return forecast(it.name, entries, it.stock, refDate);
    });
  }

  return {
    ALPHA: ALPHA,
    LOOKBACK_DAYS: LOOKBACK_DAYS,
    COVER_DAYS: COVER_DAYS,
    dailySalesSeries: dailySalesSeries,
    smooth: smooth,
    forecast: forecast,
    forecastAll: forecastAll
  };
});
