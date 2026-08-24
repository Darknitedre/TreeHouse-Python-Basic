# Previous-Day High/Low Breakout — SPY & QQQ

Intraday breakout strategy:

- **Long** when price breaks above **yesterday's high**; **short** when price
  breaks below **yesterday's low** (first breakout wins, one trade per symbol per day).
- **Stop-loss** at the opposite level (yesterday's low for longs, yesterday's high for shorts).
- **Flat by the close** — no overnight positions.

## Setup

```bash
cd trading/prev_day_high_low
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Backtest (Yahoo Finance data)

```bash
python backtest.py                              # SPY + QQQ, 5-minute bars, ~55 days
python backtest.py --interval 15m --days 40     # different granularity/window
python backtest.py --capital 25000 --slippage-bps 2
```

Note: Yahoo only provides ~60 days of intraday history. For daily-bar
approximations over many years you'd need a different data source.

The report prints every trade plus per-symbol win rate, total/average P&L,
and how often the stop was hit.

## Paper / live trading (Alpaca)

Create a free paper account at [alpaca.markets](https://alpaca.markets), then:

```bash
export ALPACA_API_KEY=your_key
export ALPACA_SECRET_KEY=your_secret
python live_trade.py                 # PAPER account (default — start here)
python live_trade.py --live          # real money, only after paper-testing
```

The bot polls 1-minute bars every 30 seconds during market hours, enters a
market order on the first breakout, places a stop order at the opposite level,
and flattens everything 5 minutes before the close.

Shorting note: shorting SPY/QQQ requires a margin account. On a cash account,
either skip shorts or expect the short entries to be rejected by the broker.

## Files

| File | Purpose |
|------|---------|
| `strategy.py` | Shared signal logic (breakout + stop checks) used by both scripts |
| `backtest.py` | Historical simulation on intraday bars with slippage and a P&L report |
| `live_trade.py` | Alpaca paper/live trading loop |

## Disclaimer

Educational code, not financial advice. Backtest results do not guarantee
future performance. Always run in paper mode first.
