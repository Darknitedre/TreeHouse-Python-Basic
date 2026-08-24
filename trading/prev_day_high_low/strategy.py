"""Shared signal logic for the previous-day high/low breakout strategy.

Rules (same for backtest and live trading):
  - Compute yesterday's regular-session high and low for each symbol.
  - LONG  when price breaks ABOVE yesterday's high (enter once per day).
  - SHORT when price breaks BELOW yesterday's low  (enter once per day).
  - Stop-loss at the opposite level (yesterday's low for longs, yesterday's
    high for shorts).
  - Any open position is closed at (or just before) the market close.
  - At most one trade per symbol per day (first breakout wins).
"""

from dataclasses import dataclass
from enum import Enum


class Side(Enum):
    LONG = "long"
    SHORT = "short"


@dataclass
class DayLevels:
    """Previous session's high and low for one symbol."""
    high: float
    low: float


@dataclass
class Signal:
    side: Side
    entry_level: float   # the level that was broken
    stop_level: float    # opposite level


def check_breakout(price_high: float, price_low: float, levels: DayLevels):
    """Return a Signal if this bar (or tick range) broke a previous-day level.

    ``price_high``/``price_low`` are the high and low of the current bar; for
    a single live quote pass the same price for both. If both levels are
    broken in the same bar (very wide bar), the long breakout is preferred
    since the high is checked first — such bars are rare on 5-minute data.
    """
    if price_high > levels.high:
        return Signal(Side.LONG, entry_level=levels.high, stop_level=levels.low)
    if price_low < levels.low:
        return Signal(Side.SHORT, entry_level=levels.low, stop_level=levels.high)
    return None


def stop_hit(side: Side, price_high: float, price_low: float, stop_level: float) -> bool:
    """True if the stop-loss level was touched within this bar."""
    if side is Side.LONG:
        return price_low <= stop_level
    return price_high >= stop_level
