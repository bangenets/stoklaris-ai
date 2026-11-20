# StokLaris AI — Stock & Profit Assistant for Indonesian Warung Owners

**SLAY HACKS 2026 submission (Devpost). Target category: Best Beginner Hack ($500).**

> Warung owners — the 64+ million micro-shops that feed Indonesia — still track
> stock on paper or in their heads. Existing POS apps cost Rp59.000–Rp99.000/month
> and force owners to tap through forms for every single sale. StokLaris lets them
> type one sentence in Bahasa Indonesia — *"jual kopi 5 @3000"* — and the on-device
> AI understands it, updates stock, computes profit, and warns before items run out.

## What it does

1. **Type naturally, in Indonesian.** One free-text line per transaction:
   `jual kopi 5 @3000`, `beli gula 2kg Rp26.000`, `laku indomie goreng 10`.
   The AI shows what it understood *before* you save — no silent misreads.
2. **Stock, revenue & profit, live.** Every entry updates the ledger. Profit is
   revenue minus cost of goods sold (average purchase price). If an item was never
   bought through the app, the dashboard says so honestly instead of inventing a cost.
3. **Demand forecast & reorder advice.** Exponential smoothing over the last
   14 days of sales predicts the stock-out date per item and suggests a reorder
   quantity covering 7 days. Statuses: Habis / Menipis (≤3 days) / Waspada (≤7 days) / Aman.
4. **100% on-device, 100% free.** No account, no server, no API key, no
   subscription. Data lives in the browser's localStorage and never leaves the phone.
   That is also the responsible-AI story: a warung owner's sales data is their
   livelihood — it should not be uploaded anywhere to get a stock alert.

## The AI (honest description)

Three small, explainable, on-device models — no LLM calls, no black box:

| Component | Technique | What it does |
|---|---|---|
| Transaction parser | Rule-based NLP: tokenization, entity extraction (item / quantity / unit / price), Indonesian number formats (`26.000` → 26000, `2,5` → 2.5) | Turns a sentence into a structured entry |
| Item categorizer | Naive Bayes classifier over a built-in Indonesian keyword set (Minuman, Makanan, Rokok, Sembako, Kebutuhan Harian) | Auto-tags every item; unknown items → "Lainnya" |
| Demand forecaster | Single exponential smoothing (α = 0.3) on daily sales, 14-day lookback | Predicts daily demand → days until stock-out → reorder quantity |

Known limits (stated, not hidden): the parser understands the documented
formats (see below); unusual phrasing falls back to "item only, no price" and the
UI asks the owner to confirm. The forecaster needs sales history — a brand-new
item with no sales shows "Belum laku" instead of a fake prediction.

## Supported input formats

```
jual kopi 5 @3000          sale, kopi, 5 pcs, Rp3.000 each
jual kopi 5 15000          sale, kopi, 5 pcs, Rp15.000 total
beli gula 2kg Rp26.000     purchase, gula, 2 kg, Rp26.000 total
laku indomie goreng 10     sale, indomie goreng, 10 pcs, price ?
beli beras 5 kg            purchase, beras, 5 kg, price ?
jual rokok 2 bungkus harga 22000   sale, rokok, 2 bungkus, Rp22.000 each
```

Type words: `jual / terjual / laku / keluar` = sale; `beli / kulak / masuk / restok` = purchase.
Units: kg, gram, liter, ml, pcs, bungkus, botol, dus, renceng, sachet, pack, karung, kaleng, porsi, ikat, lembar, buah, batang, slop.

## Run it

```bash
# Option 1 — just open it (all logic is client-side)
open index.html

# Option 2 — local server (same result)
python3 -m http.server 8000
# then open http://localhost:8000

# Tests (Node, no dependencies) — 51 assertions
node tests/run-tests.js
# or: npm test
```

Deep-link demo (prefills an example and shows the AI parse):
`index.html#coba=jual%20kopi%205%20%403000`

On first run the app seeds 14 days of realistic sample data so the dashboard,
alerts and forecast are visible immediately. "Muat data contoh" re-seeds it;
"Hapus semua" clears everything.

## Project structure

```
index.html            App shell (Indonesian UI, mobile-first)
css/styles.css        Styling, no framework
js/nlp.js             Parser + Naive Bayes categorizer
js/forecast.js        Exponential-smoothing forecaster
js/store.js           Ledger, stock/profit math, sample data, localStorage
js/app.js             UI wiring
tests/run-tests.js    51 Node assertions (parser, classifier, forecast, store)
screenshots/          Real renders: mobile.png, mobile-parse.png, desktop.png
demo-script.md        2–4 min demo video script (for the Devpost video)
SUBMISSION.md         Copy-paste text for the Devpost submission form
```

## How it was built

- Vanilla HTML/CSS/JS only — zero dependencies, zero build step, so a judge can
  open it and use it in under a minute.
- Core logic (`js/*.js`) is framework-free and dual-mode: it runs in the browser
  and under Node, which is how the same code is unit-tested.
- Built by a first-time hackathon participant, with an AI coding agent, over
  ~1 day (Nov 20, 2026).

## Submission checklist (Devpost)

- [x] Working prototype (this repo, runs offline)
- [x] Screenshots (`screenshots/`)
- [ ] Demo video 2–4 min — script in `demo-script.md`, record on a phone
- [ ] Push to GitHub (user repo `bangenets`) and link it in the submission
- [ ] Deploy the static files somewhere public (GitHub Pages is free) — or
      submit with the video + repo only (allowed: "a demonstration video may be
      provided if a live demo is not available")
- [ ] Confirm Best Beginner eligibility: the project must be built entirely by
      first-time hackathon participants
- [ ] Submit before **Dec 7, 2026, 17:00 EST (Dec 8, 05:00 WIB)**

## Prizes (as published on the Devpost page)

Grand $2,000 · Runner-Up $1,200 · 3rd $800 · **Best Beginner Hack $500** ·
participation certificates. Page header states a $5,000 pool; the listed cash
prizes total $4,500. Judging: Innovation 25%, Technical 25%, Real World Impact
20%, AI Integration 15%, UX & Presentation 15%. Judging Dec 8–14, winners Dec 16.

## License

MIT — see `LICENSE`.
