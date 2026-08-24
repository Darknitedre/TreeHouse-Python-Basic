"""Paper/live trading of the previous-day high/low breakout via Alpaca.

Uses the ``alpaca-py`` SDK. Point it at your PAPER account first:

    export ALPACA_API_KEY=...
    export ALPACA_SECRET_KEY=...
    python live_trade.py                 # paper trading (default)
    python live_trade.py --live          # real money — only when you're sure

Behavior each trading day:
  - At startup, pull yesterday's regular-session high/low for each symbol.
  - Poll the latest 1-minute bar every POLL_SECONDS during market hours.
  - First breakout of the day per symbol enters a bracket-less market order
    with a separate stop order at the opposite level.
  - At FLATTEN_MINUTES before the close, cancel open stops and flatten
    everything, then wait for the next session.

This script keeps at most one position per symbol per day and never trades
outside regular hours. It is intentionally simple: no persistence, so if you
restart it mid-day it will re-check current positions from the account.
"""

import argparse
import logging
import os
import time
from datetime import datetime, timedelta, timezone

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import MarketOrderRequest, StopOrderRequest

from strategy import DayLevels, Side, check_breakout

POLL_SECONDS = 30
FLATTEN_MINUTES = 5  # flatten this many minutes before the close

log = logging.getLogger("pdhl")


def get_clients(live: bool):
    key = os.environ.get("ALPACA_API_KEY")
    secret = os.environ.get("ALPACA_SECRET_KEY")
    if not key or not secret:
        raise SystemExit("Set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables.")
    trading = TradingClient(key, secret, paper=not live)
    data = StockHistoricalDataClient(key, secret)
    return trading, data


def prev_day_levels(data: StockHistoricalDataClient, symbol: str) -> DayLevels:
    """Yesterday's (last completed session's) regular-hours high and low."""
    req = StockBarsRequest(
        symbol_or_symbols=symbol,
        timeframe=TimeFrame(1, TimeFrameUnit.Day),
        start=datetime.now(timezone.utc) - timedelta(days=10),
    )
    bars = data.get_stock_bars(req).data[symbol]
    completed = [b for b in bars if b.timestamp.date() < datetime.now(timezone.utc).date()]
    last = completed[-1]
    return DayLevels(high=float(last.high), low=float(last.low))


def latest_minute_bar(data: StockHistoricalDataClient, symbol: str):
    req = StockBarsRequest(
        symbol_or_symbols=symbol,
        timeframe=TimeFrame(1, TimeFrameUnit.Minute),
        start=datetime.now(timezone.utc) - timedelta(minutes=15),
    )
    bars = data.get_stock_bars(req).data.get(symbol, [])
    return bars[-1] if bars else None


def position_qty(trading: TradingClient, symbol: str) -> float:
    for pos in trading.get_all_positions():
        if pos.symbol == symbol:
            return float(pos.qty)
    return 0.0


def enter(trading: TradingClient, symbol: str, side: Side, shares: int, stop_level: float):
    order_side = OrderSide.BUY if side is Side.LONG else OrderSide.SELL
    stop_side = OrderSide.SELL if side is Side.LONG else OrderSide.BUY
    trading.submit_order(MarketOrderRequest(
        symbol=symbol, qty=shares, side=order_side, time_in_force=TimeInForce.DAY))
    log.info("%s: entered %s %d shares (stop %.2f)", symbol, side.value, shares, stop_level)
    trading.submit_order(StopOrderRequest(
        symbol=symbol, qty=shares, side=stop_side,
        stop_price=round(stop_level, 2), time_in_force=TimeInForce.DAY))


def flatten_all(trading: TradingClient, symbols: list):
    trading.cancel_orders()
    for sym in symbols:
        if position_qty(trading, sym) != 0:
            trading.close_position(sym)
            log.info("%s: flattened at end of day", sym)


def run_session(trading: TradingClient, data: StockHistoricalDataClient,
                symbols: list, capital_per_trade: float):
    clock = trading.get_clock()
    if not clock.is_open:
        wait = (clock.next_open - clock.timestamp).total_seconds()
        log.info("Market closed. Sleeping %.0f min until next open.", wait / 60)
        time.sleep(max(wait, 30))
        return

    levels = {s: prev_day_levels(data, s) for s in symbols}
    for s, lv in levels.items():
        log.info("%s: prev-day high %.2f / low %.2f", s, lv.high, lv.low)

    traded_today = {s: position_qty(trading, s) != 0 for s in symbols}
    flatten_at = trading.get_clock().next_close - timedelta(minutes=FLATTEN_MINUTES)

    while True:
        now = datetime.now(timezone.utc)
        if now >= flatten_at:
            flatten_all(trading, symbols)
            log.info("Session done. Waiting for next open.")
            return

        for sym in symbols:
            if traded_today[sym]:
                continue
            bar = latest_minute_bar(data, sym)
            if bar is None:
                continue
            sig = check_breakout(float(bar.high), float(bar.low), levels[sym])
            if sig is None:
                continue
            shares = int(capital_per_trade // float(bar.close))
            if shares == 0:
                log.warning("%s: capital too small for one share at %.2f", sym, bar.close)
                traded_today[sym] = True
                continue
            enter(trading, sym, sig.side, shares, sig.stop_level)
            traded_today[sym] = True

        time.sleep(POLL_SECONDS)


def main():
    p = argparse.ArgumentParser(description="Previous-day high/low breakout — Alpaca")
    p.add_argument("--symbols", nargs="+", default=["SPY", "QQQ"])
    p.add_argument("--capital", type=float, default=10_000, help="capital per trade")
    p.add_argument("--live", action="store_true",
                   help="trade the LIVE account instead of paper (be careful)")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    trading, data = get_clients(args.live)
    log.info("Connected to Alpaca (%s account). Symbols: %s",
             "LIVE" if args.live else "PAPER", ", ".join(args.symbols))

    while True:
        try:
            run_session(trading, data, args.symbols, args.capital)
        except KeyboardInterrupt:
            log.info("Stopping. Open positions/stops are left untouched.")
            break
        except Exception:
            log.exception("Error in session loop; retrying in 60s")
            time.sleep(60)


if __name__ == "__main__":
    main()
