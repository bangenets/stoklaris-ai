# SUBMISSION.md — Devpost copy for SLAY HACKS 2026
# Paste each section into the matching Devpost field. Fill in [BRACKETS] at submit time.
# Deadline: Dec 7, 2026 17:00 EST (Dec 8, 2026 05:00 WIB).

## Project name
StokLaris AI

## Tagline
Type one sentence in Indonesian — AI tracks your warung's stock, profit, and reorder dates. Free, offline, no account.

## Inspiration / Problem
Indonesia has 64+ million micro-businesses, and the warung (neighborhood shop) is
the most common of all. Most owners still track stock on paper or in their heads.
They find out a bestseller is gone only when a customer asks for it — lost sale,
lost trust. Existing POS apps solve this, but they cost Rp59.000–Rp99.000/month
and force the owner to tap through product forms for every single sale. For a
shop earning a few hundred thousand rupiah a day, that is too much money and too
much friction. The owner already knows how to describe a sale in one sentence:
"jual kopi 5 @3000". We built the app that understands that sentence.

## What it does
StokLaris AI is a web app that runs 100% on the device — no account, no server,
no API key, no subscription. The owner types a transaction in plain Bahasa
Indonesia and the app:
1. Parses it with on-device NLP (item, quantity, unit, price) and shows what it
   understood before saving — no silent misreads.
2. Updates stock, revenue and profit live (profit = revenue minus average
   purchase cost; unknown costs are flagged, never invented).
3. Forecasts demand with exponential smoothing over 14 days of sales, predicts
   the stock-out date per item, and suggests a reorder quantity covering 7 days.
4. Auto-categorizes items (Minuman, Makanan, Rokok, Sembako, Kebutuhan Harian)
   with a Naive Bayes classifier.
On first run it seeds 14 days of sample data so the dashboard, alerts and
forecast are visible immediately.

## How we built it
Vanilla HTML/CSS/JavaScript — zero dependencies, zero build step — so anyone can
open index.html and use it in under a minute. The AI is three small, explainable,
on-device models: (1) a rule-based NLP parser with Indonesian number handling
("26.000" = 26000, "2,5" = 2.5); (2) a Naive Bayes item categorizer over a
built-in Indonesian keyword set; (3) single exponential smoothing (alpha 0.3) for
demand forecasting. Core logic is dual-mode (browser + Node) and covered by 51
unit tests (`node tests/run-tests.js`). Screenshots were taken from the real app
in headless Chromium, mobile and desktop.

## Challenges we ran into
- Indonesian is wonderfully loose: "beli gula 2kg Rp26.000" and "jual kopi 5
  15000" look similar but mean different things (per-unit vs total price). We
  settled on an explicit, documented rule: @ / Rp / "harga" = per-unit, a bare
  trailing number = total — and the preview box shows the interpretation before
  saving, so a wrong guess is caught by the user, not hidden.
- A forecast is only as honest as its history. A new item with no sales gets
  "Belum laku" instead of a fabricated prediction, and profit for items without
  a recorded purchase price is flagged as incomplete.

## Accomplishments that we're proud of
- A full working prototype that a warung owner can genuinely use today, on a
  phone, offline, for free.
- The AI is honest by design: it shows its understanding, admits unknown costs,
  and refuses to predict without data.
- 51/51 unit tests passing, real screenshots, and a demo that runs without any
  setup.

## What we learned
Small, explainable models beat a big black box when the user is a shop owner who
needs to trust the number on the screen. And the hardest part of "AI for
everyone" is not the model — it is meeting the user in their own language and
their own workflow.

## What's next
- Voice input (speak the transaction instead of typing it).
- Supplier price comparison: warn when a kulak price is above the usual range.
- Optional cloud backup (opt-in only — the default stays fully offline).

## Built with
JavaScript, HTML, CSS. No frameworks, no backend, no paid APIs.

## Links (fill in at submit time)
- Demo / live app: [GITHUB PAGES URL — deploy index.html, css/, js/]
- Source code: https://github.com/bangenets/[REPO NAME]
- Demo video (2–4 min): [YOUTUBE/DRIVE LINK — script in demo-script.md]
- Screenshots: in this repo under screenshots/
