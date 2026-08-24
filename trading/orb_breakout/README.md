# Opening Range Breakout (ORB) Backtester — SPY / QQQ / IWM

5-minute opening-range breakout study with cost modelling, four filter
variants, two profit targets, and a 70/30 out-of-sample split.

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
# Quick check (Yahoo, free, but only ~60 days of 5-minute history)
python orb_backtest.py

# A real multi-year study (recommended)
export ALPACA_API_KEY=...  ALPACA_SECRET_KEY=...  ALPACA_FEED=sip
python orb_backtest.py --provider alpaca --years 5

# Verify the engine before trusting any number it prints
python test_orb.py
```

Useful flags: `--symbols SPY QQQ IWM`, `--start/--end`, `--years`,
`--risk 500`, `--entry-on {next_open,signal_close}`, `--atr-mode
{continuous,session}`, `--plot-all`, `--no-plots`, `--outdir results`.

## Data providers

Yahoo caps intraday history at ~60 calendar days, which is nowhere near the
2–5 years this study needs. Swap providers with one flag — `data_sources.py`
is the only file that knows about vendors, and every loader returns the same
contract (tz-aware `America/New_York` index, `open/high/low/close/volume`,
start-stamped bars).

| Provider | Flag | Credentials | Intraday history |
|---|---|---|---|
| Yahoo | `--provider yahoo` | none | ~60 days |
| Alpaca | `--provider alpaca` | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_FEED` | 2016→ on SIP |
| Polygon | `--provider polygon` | `POLYGON_API_KEY` | years, plan-dependent |
| Databento | `--provider databento` | `DATABENTO_API_KEY`, `DATABENTO_DATASET` | deep |
| IBKR | `--provider ibkr` | TWS/Gateway on `IB_PORT` | ~years, rate-limited |
| Local CSV | `--provider csv` | `data/<SYM>_5m.csv` | whatever you have |
| Synthetic | `--provider synthetic` | none | **code test only** |

On Alpaca prefer `ALPACA_FEED=sip`. The free IEX feed carries only a few
percent of the consolidated tape, so the 20-bar volume filter would be
measuring IEX's market share rather than real participation.

To add a provider, write one function returning that contract and register it
in `PROVIDERS`. No strategy code changes.

## Outputs (`results/`)

`trade_log.csv` (every field per trade), `strategy_summary.csv`
(version × target × ticker × {IS, OOS, FULL}), `version_comparison.csv`,
`in_vs_out_of_sample.csv`, `filter_diagnostics.csv`,
`breakdown_*.csv` (day of week, month, year, entry time, direction, ticker),
and `charts_*.png` (equity, drawdown, cumulative R, monthly P&L).

## Modelling choices worth arguing about

Costs (top of `orb_backtest.py`): $0.005/share commission with a $1.00 order
minimum, $0.005 half-spread, $0.005 slippage on market orders. Limit exits at
the target pay no slippage; stops and time exits do. Sizing is constant risk
($500/trade), which keeps R-multiples comparable across years instead of
compounding them.

**Bias controls** — each one is asserted in `test_orb.py`:

- Signals are read from **closed** bars; fills are the **next** bar's open.
- VWAP, ATR and average volume come from the signal bar, already complete.
- Average volume uses the 20 bars *before* the signal bar, so a candle is
  never compared against an average containing itself.
- ATR is Wilder's, and the first bar of each session uses high−low, so the
  overnight gap never inflates intraday volatility.
- A bar spanning both stop and target is scored a **loss** — 5-minute bars
  carry no intrabar sequence.
- A bar that gaps through the stop fills at the open, not at the stop.
- Everything is converted to `America/New_York` before slicing, so the
  session boundaries survive DST.

## Two structural findings

Both are visible in the exported CSVs; confirm the exact magnitudes on your
own data before drawing conclusions.

1. **The opening-range stop is nearly dead code.** The rule takes the tighter
   of 1×ATR(14) and the opposite side of the range. A 5-minute ATR is far
   smaller than a 15-minute opening range, so the ATR stop wins almost every
   time — check `stop_source` in `trade_log.csv`. This is effectively an
   ATR-stop strategy.
2. **The VWAP filter is close to redundant.** Closing above the opening-range
   high already implies trading above every price of the first 15 minutes, so
   the VWAP condition is usually satisfied by construction and Version B ≈
   Version A, Version D ≈ Version C. `filter_diagnostics.csv` reports the
   pass rate. The volume filter, by contrast, does real work.

## Verification status

`test_orb.py` — 42 assertions covering the opening-range window, VWAP, ATR,
volume lookback, entry timing, stop-first resolution, gap fills, the trading
restrictions, stop selection, cost accounting, DST and the 70/30 split.

The engine also passes a **null test**: on a driftless random walk it returns
a 39.4% win rate at 1.5R and 33.9% at 2R against theoretical breakevens of
40.0% and 33.3%, with mean −1.03R on stops and +1.49R on targets, and a
profit factor just below 1. An engine with look-ahead leakage would print win
rates well above breakeven on the same data.
