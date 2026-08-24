"""Backtest the previous-day high/low breakout strategy on intraday bars.

Data comes from Yahoo Finance via ``yfinance``. Yahoo only serves roughly the
last 60 days of intraday bars, so the default window is 55 days of 5-minute
data. Entries fill at the broken level (plus optional slippage), stops fill at
the opposite level, and anything still open exits on the last bar of the day.

Usage:
    python backtest.py                          # SPY + QQQ, 5m bars, 55 days
    python backtest.py --symbols SPY QQQ IWM --interval 15m --days 40
    python backtest.py --capital 25000 --slippage-bps 2
"""

import argparse
from dataclasses import dataclass

import pandas as pd
import yfinance as yf

from strategy import DayLevels, Side, check_breakout, stop_hit


@dataclass
class Trade:
    symbol: str
    date: object
    side: str
    entry_time: object
    entry_price: float
    exit_time: object
    exit_price: float
    exit_reason: str  # "stop" or "eod"
    shares: int
    pnl: float


def fetch_intraday(symbol: str, days: int, interval: str) -> pd.DataFrame:
    df = yf.download(symbol, period=f"{days}d", interval=interval,
                     prepost=False, auto_adjust=False, progress=False)
    if df.empty:
        raise RuntimeError(f"No data returned for {symbol}")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df[["Open", "High", "Low", "Close"]].dropna()


def backtest_symbol(symbol: str, bars: pd.DataFrame, capital_per_trade: float,
                    slippage_bps: float) -> list:
    trades = []
    slip = slippage_bps / 10_000.0
    days = [group for _, group in bars.groupby(bars.index.date)]

    for prev_day, day in zip(days, days[1:]):
        levels = DayLevels(high=float(prev_day["High"].max()),
                           low=float(prev_day["Low"].min()))
        position = None

        for ts, bar in day.iterrows():
            hi, lo = float(bar["High"]), float(bar["Low"])

            if position is None:
                sig = check_breakout(hi, lo, levels)
                if sig is None:
                    continue
                # If the day gaps open beyond the level, fill at the open
                # instead of the (unreachable) level itself.
                open_px = float(bar["Open"])
                if sig.side is Side.LONG:
                    fill = max(sig.entry_level, open_px) * (1 + slip)
                else:
                    fill = min(sig.entry_level, open_px) * (1 - slip)
                shares = int(capital_per_trade // fill)
                if shares == 0:
                    break
                position = (sig, ts, fill, shares)
                # A bar can break the level and then hit the stop; check below.
                sig, entry_ts, entry_px, shares = position
                if stop_hit(sig.side, hi, lo, sig.stop_level):
                    trades.append(_close(symbol, position, ts, sig.stop_level, "stop", slip))
                    position = None
                    break  # one trade per day
                continue

            sig, entry_ts, entry_px, shares = position
            if stop_hit(sig.side, hi, lo, sig.stop_level):
                trades.append(_close(symbol, position, ts, sig.stop_level, "stop", slip))
                position = None
                break  # one trade per day

        if position is not None:
            last_ts = day.index[-1]
            last_close = float(day.iloc[-1]["Close"])
            trades.append(_close(symbol, position, last_ts, last_close, "eod", slip))

    return trades


def _close(symbol, position, exit_ts, exit_px, reason, slip) -> Trade:
    sig, entry_ts, entry_px, shares = position
    if sig.side is Side.LONG:
        exit_fill = exit_px * (1 - slip)
        pnl = (exit_fill - entry_px) * shares
    else:
        exit_fill = exit_px * (1 + slip)
        pnl = (entry_px - exit_fill) * shares
    return Trade(symbol=symbol, date=entry_ts.date(), side=sig.side.value,
                 entry_time=entry_ts, entry_price=round(entry_px, 4),
                 exit_time=exit_ts, exit_price=round(exit_fill, 4),
                 exit_reason=reason, shares=shares, pnl=round(pnl, 2))


def report(trades: list, capital_per_trade: float) -> None:
    if not trades:
        print("No trades were generated.")
        return
    df = pd.DataFrame([t.__dict__ for t in trades]).sort_values("entry_time")
    print("\n=== Trades ===")
    print(df.to_string(index=False))

    print("\n=== Summary ===")
    for sym, g in df.groupby("symbol"):
        wins = (g["pnl"] > 0).sum()
        print(f"\n{sym}: {len(g)} trades | win rate {wins / len(g):.0%} | "
              f"total P&L ${g['pnl'].sum():,.2f} | avg ${g['pnl'].mean():,.2f} | "
              f"best ${g['pnl'].max():,.2f} | worst ${g['pnl'].min():,.2f} | "
              f"stopped out {(g['exit_reason'] == 'stop').mean():.0%}")
    total = df["pnl"].sum()
    print(f"\nAll symbols: {len(df)} trades, total P&L ${total:,.2f} "
          f"({total / capital_per_trade:+.2%} on ${capital_per_trade:,.0f} per-trade capital)")


def main() -> None:
    p = argparse.ArgumentParser(description="Previous-day high/low breakout backtest")
    p.add_argument("--symbols", nargs="+", default=["SPY", "QQQ"])
    p.add_argument("--days", type=int, default=55, help="lookback days (Yahoo intraday max ~60)")
    p.add_argument("--interval", default="5m", choices=["1m", "2m", "5m", "15m", "30m", "60m"])
    p.add_argument("--capital", type=float, default=10_000, help="capital allocated per trade")
    p.add_argument("--slippage-bps", type=float, default=1.0, help="slippage per side, basis points")
    args = p.parse_args()

    all_trades = []
    for sym in args.symbols:
        print(f"Fetching {args.interval} bars for {sym}...")
        bars = fetch_intraday(sym, args.days, args.interval)
        all_trades += backtest_symbol(sym, bars, args.capital, args.slippage_bps)
    report(all_trades, args.capital)


if __name__ == "__main__":
    main()
