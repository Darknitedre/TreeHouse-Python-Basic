#!/usr/bin/env python3
"""Opening Range Breakout (ORB) backtester for SPY / QQQ / IWM on 5-minute bars.

Strategy
--------
Opening range = 09:30-09:45 ET (the bars stamped 09:30, 09:35, 09:40).
Long  when a 5-min candle CLOSES above the OR high, price is above session
      VWAP, and the candle's volume beats the 20-bar average volume.
Short is the mirror image below the OR low.
Stop  = whichever is TIGHTER of (1 x ATR14) and the opposite side of the OR.
Target= 1.5R or 2R, backtested separately.
One long attempt and one short attempt per ticker per day, no new entries at
or after 11:00 ET, anything still open is flattened at 15:55 ET, never
overnight, never two open positions in the same ticker.

Bias controls (read this before trusting any number)
----------------------------------------------------
* A signal is evaluated only on a CLOSED bar; the fill is the NEXT bar's open.
  Nothing is ever transacted at a price that was not yet printed.
* VWAP, ATR and average volume are read from the SIGNAL bar, which has fully
  closed by the time the order goes out.
* Average volume uses the 20 bars BEFORE the signal bar (``.shift(1)``), so a
  candle is never compared against an average that contains itself.
* ATR is Wilder's, and the first bar of each session uses high-low as its
  true range so the overnight gap does not contaminate intraday volatility.
* If a bar's range spans both the stop and the target, the STOP is assumed
  first -- 5-minute bars cannot resolve intrabar sequence.
* All timestamps are converted to America/New_York before anything is sliced,
  so DST shifts cannot smear the session boundaries.

Run ``python orb_backtest.py --help`` for options.
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass, field, asdict
from datetime import time as dtime

import numpy as np
import pandas as pd

import data_sources as ds

# ==========================================================================
# TUNABLE ASSUMPTIONS -- everything you would realistically argue about
# ==========================================================================

# --- costs -----------------------------------------------------------------
COMMISSION_PER_SHARE = 0.005    # $/share, typical US equity broker
MIN_COMMISSION_ORDER = 1.00     # $ floor per order (entry and exit each pay)
HALF_SPREAD = 0.005             # $/share. SPY/QQQ/IWM quote ~$0.01 wide, so
                                # you cross half of it on a marketable order.
SLIPPAGE_PER_SHARE = 0.005      # $/share extra for market orders (latency,
                                # queue position, momentum against you)

# --- position sizing -------------------------------------------------------
STARTING_EQUITY = 100_000.0
RISK_PER_TRADE = 500.0          # $ risked between entry and stop (0.5%).
                                # Constant risk keeps R-multiples comparable
                                # across years instead of compounding them.
MAX_SHARES = 100_000            # sanity cap for very tight stops

# --- session / strategy clock (all times America/New_York) -----------------
SESSION_OPEN = dtime(9, 30)
OR_END = dtime(9, 45)           # opening range is [09:30, 09:45)
LAST_ENTRY = dtime(11, 0)       # no fills at or after this time
EOD_FLAT = dtime(15, 55)        # flatten here
SESSION_END = dtime(16, 0)

# --- indicators ------------------------------------------------------------
ATR_PERIOD = 14
VOL_LOOKBACK = 20
BAR_MINUTES = 5

# --- study design ----------------------------------------------------------
TARGETS = {"1.5R": 1.5, "2R": 2.0}
VERSIONS = {                    # name -> (require VWAP filter, require volume filter)
    "A_orb_only": (False, False),
    "B_orb_vwap": (True, False),
    "C_orb_volume": (False, True),
    "D_orb_vwap_volume": (True, True),
}
PRIMARY_VERSION = "D_orb_vwap_volume"
IN_SAMPLE_FRACTION = 0.70       # first 70% of sessions is development data
MIN_TRADES_FOR_RANKING = 30     # below this a result is noise, not evidence
TRADING_DAYS_PER_YEAR = 252


@dataclass
class Config:
    """One backtest variant.  Everything the engine needs, nothing it doesn't."""
    version: str = PRIMARY_VERSION
    target_name: str = "1.5R"
    target_r: float = 1.5
    use_vwap_filter: bool = True
    use_volume_filter: bool = True
    atr_mode: str = "continuous"        # 'continuous' | 'session'
    entry_on: str = "next_open"         # 'next_open' (unbiased) | 'signal_close'
    risk_per_trade: float = RISK_PER_TRADE

    @staticmethod
    def build(version: str, target_name: str, **overrides) -> "Config":
        vwap, volume = VERSIONS[version]
        cfg = Config(
            version=version,
            target_name=target_name,
            target_r=TARGETS[target_name],
            use_vwap_filter=vwap,
            use_volume_filter=volume,
        )
        for key, value in overrides.items():
            if value is not None and hasattr(cfg, key):
                setattr(cfg, key, value)
        return cfg

    @property
    def label(self) -> str:
        return f"{self.version}@{self.target_name}"


# ==========================================================================
# 1. LOADING DATA
# ==========================================================================
def load_symbol_data(symbol, start, end, provider, cache_dir, use_cache=True) -> pd.DataFrame:
    """Fetch bars and keep only the regular session, in market time."""
    df = ds.load_bars(symbol, start, end, provider=provider,
                      minutes=BAR_MINUTES, cache_dir=cache_dir, use_cache=use_cache)
    if df.empty:
        return df
    return filter_regular_hours(df)


def filter_regular_hours(df: pd.DataFrame) -> pd.DataFrame:
    """Keep bars whose START is in [09:30, 16:00) New York time.

    The index is already America/New_York (the loader guarantees it), so this
    slice is DST-correct: 09:30 means 09:30 local on every date, EST or EDT.
    """
    idx_time = df.index.time
    mask = (idx_time >= SESSION_OPEN) & (idx_time < SESSION_END)
    out = df.loc[mask].copy()
    out["session"] = out.index.date
    return out


# ==========================================================================
# 2. CALCULATING INDICATORS
# ==========================================================================
def add_indicators(df: pd.DataFrame, atr_mode: str = "continuous") -> pd.DataFrame:
    """Attach VWAP, ATR and average volume.  All causal, all bar-close values."""
    df = df.copy()
    df = add_session_vwap(df)
    df = add_atr(df, ATR_PERIOD, atr_mode)
    df = add_avg_volume(df, VOL_LOOKBACK)
    return df


def add_session_vwap(df: pd.DataFrame) -> pd.DataFrame:
    """Session-anchored VWAP: resets at 09:30 every day.

    Typical price (H+L+C)/3 weighted by volume, cumulative from the open.  The
    value on a bar includes that bar, which is legitimate -- the bar has
    closed before we act on it -- but never any later bar.
    """
    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    pv = typical * df["volume"]
    cum_pv = pv.groupby(df["session"], sort=False).cumsum()
    cum_vol = df["volume"].groupby(df["session"], sort=False).cumsum()
    df["vwap"] = np.where(cum_vol > 0, cum_pv / cum_vol.replace(0, np.nan), np.nan)
    return df


def add_atr(df: pd.DataFrame, period: int = ATR_PERIOD, mode: str = "continuous") -> pd.DataFrame:
    """Wilder's ATR on 5-minute bars.

    True range needs the previous close, but the previous close of the 09:30
    bar belongs to *yesterday*.  Using it would inject the overnight gap into
    intraday volatility and blow the first ATR readings of every session out
    of proportion, so the first bar of each session falls back to high-low.

    mode='continuous' carries the average across sessions (default: at 09:45
    you have only three bars of today, so an average that resets daily would
    be undefined).  mode='session' restarts each day and is only usable if you
    also shorten the period.
    """
    df = df.copy()
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)

    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)

    first_of_session = df["session"] != df["session"].shift(1)
    tr[first_of_session] = (high - low)[first_of_session]
    df["true_range"] = tr

    if mode == "session":
        df["atr"] = tr.groupby(df["session"], sort=False).transform(
            lambda s: s.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
        )
    else:
        # Wilder smoothing == EWM with alpha = 1/period, no bias adjustment.
        df["atr"] = tr.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    return df


def add_avg_volume(df: pd.DataFrame, lookback: int = VOL_LOOKBACK) -> pd.DataFrame:
    """Average volume of the ``lookback`` bars BEFORE the current one.

    The shift matters: comparing a bar to an average that already contains it
    mechanically softens the filter, especially on the huge opening bars.
    """
    df = df.copy()
    df["avg_volume"] = (
        df["volume"].rolling(lookback, min_periods=lookback).mean().shift(1)
    )
    return df


# ==========================================================================
# 3. IDENTIFYING THE OPENING RANGE
# ==========================================================================
def compute_opening_range(day_bars: pd.DataFrame):
    """(high, low) of the bars stamped 09:30 <= t < 09:45, or None if absent.

    Returning None for a malformed session (late open, halt, missing bars) is
    deliberate -- we skip the day rather than guess a range.
    """
    times = day_bars.index.time
    or_mask = (times >= SESSION_OPEN) & (times < OR_END)
    or_bars = day_bars.loc[or_mask]
    if or_bars.empty:
        return None
    # Need the full 15 minutes; a partial range is not the range we specified.
    expected = int(15 // BAR_MINUTES)
    if len(or_bars) < expected:
        return None
    return float(or_bars["high"].max()), float(or_bars["low"].min())


# ==========================================================================
# 4. GENERATING SIGNALS
# ==========================================================================
def evaluate_signal(bar, orh: float, orl: float, cfg: Config):
    """Direction this CLOSED bar signals under ``cfg``, or None.

    Every input is a property of this bar or of bars before it.
    """
    close, volume = bar["close"], bar["volume"]
    vwap, avg_vol = bar["vwap"], bar["avg_volume"]

    volume_ok = True
    if cfg.use_volume_filter:
        if not np.isfinite(avg_vol):
            return None                     # not enough history yet -> no trade
        volume_ok = volume > avg_vol

    if close > orh:                          # long breakout
        if cfg.use_vwap_filter and not (np.isfinite(vwap) and close > vwap):
            return None
        return "long" if volume_ok else None

    if close < orl:                          # short breakdown
        if cfg.use_vwap_filter and not (np.isfinite(vwap) and close < vwap):
            return None
        return "short" if volume_ok else None

    return None


def filter_diagnostics(data: dict) -> pd.DataFrame:
    """How often does each filter actually reject a breakout candle?

    Worth knowing before you read the version comparison: if a filter almost
    never binds, versions that differ only by that filter are the SAME
    strategy, and any gap between their results is noise, not evidence.
    """
    rows = []
    for symbol, df in data.items():
        breakouts = vwap_ok = vol_ok = both_ok = 0
        for _, day in df.groupby("session", sort=True):
            rng = compute_opening_range(day)
            if rng is None:
                continue
            orh, orl = rng
            window = day[(day.index.time >= OR_END) & (day.index.time < LAST_ENTRY)]
            for _, bar in window.iterrows():
                if bar["close"] > orh:
                    long_side = True
                elif bar["close"] < orl:
                    long_side = False
                else:
                    continue
                breakouts += 1
                v = np.isfinite(bar["vwap"]) and (
                    bar["close"] > bar["vwap"] if long_side else bar["close"] < bar["vwap"]
                )
                q = np.isfinite(bar["avg_volume"]) and bar["volume"] > bar["avg_volume"]
                vwap_ok += bool(v)
                vol_ok += bool(q)
                both_ok += bool(v and q)
        rows.append(
            {
                "ticker": symbol, "breakout_candles": breakouts,
                "pass_vwap_pct": 100.0 * vwap_ok / breakouts if breakouts else np.nan,
                "pass_volume_pct": 100.0 * vol_ok / breakouts if breakouts else np.nan,
                "pass_both_pct": 100.0 * both_ok / breakouts if breakouts else np.nan,
            }
        )
    return pd.DataFrame(rows)


# ==========================================================================
# 5. EXECUTING TRADES
# ==========================================================================
def _commission(shares: int) -> float:
    """Per-order commission with the broker's minimum applied."""
    return max(shares * COMMISSION_PER_SHARE, MIN_COMMISSION_ORDER)


def _market_fill(raw_price: float, direction: str, side: str) -> float:
    """Adverse fill for a marketable order: cross the spread, then slip.

    ``side`` is 'enter' or 'exit'; the cost always works against the trader.
    """
    buying = (direction == "long" and side == "enter") or (direction == "short" and side == "exit")
    cost = HALF_SPREAD + SLIPPAGE_PER_SHARE
    return raw_price + cost if buying else raw_price - cost


def open_position(symbol, direction, signal_bar, signal_time, raw_entry,
                  entry_time, orh, orl, cfg: Config):
    """Build a position, or return None if the trade is not takeable.

    Stop selection is the rule as specified: whichever of (1 ATR) and the
    opposite side of the opening range sits CLOSER to the entry.  The chosen
    source is recorded so you can see which one actually binds in practice.
    """
    atr = float(signal_bar["atr"])
    if not np.isfinite(atr) or atr <= 0:
        return None                       # ATR not warmed up yet -> stand aside

    entry = _market_fill(raw_entry, direction, "enter")

    if direction == "long":
        atr_stop, or_stop = entry - atr, orl
        stop = max(atr_stop, or_stop)                 # higher == tighter for a long
        stop_source = "atr" if atr_stop >= or_stop else "or_low"
        if stop >= entry:                             # rule: stop must be below entry
            return None
        target = entry + cfg.target_r * (entry - stop)
    else:
        atr_stop, or_stop = entry + atr, orh
        stop = min(atr_stop, or_stop)                 # lower == tighter for a short
        stop_source = "atr" if atr_stop <= or_stop else "or_high"
        if stop <= entry:                             # rule: stop must be above entry
            return None
        target = entry - cfg.target_r * (stop - entry)

    risk_per_share = abs(entry - stop)
    if risk_per_share <= 0.01:            # sub-penny risk => absurd size
        return None
    shares = int(min(MAX_SHARES, np.floor(cfg.risk_per_trade / risk_per_share)))
    if shares < 1:
        return None

    return {
        "ticker": symbol,
        "session": signal_time.date(),
        "direction": direction,
        "signal_time": signal_time,
        "entry_time": entry_time,
        "raw_entry": float(raw_entry),
        "entry_price": float(entry),
        "or_high": float(orh),
        "or_low": float(orl),
        "vwap": float(signal_bar["vwap"]),
        "volume": float(signal_bar["volume"]),
        "avg_volume_20": float(signal_bar["avg_volume"]) if np.isfinite(signal_bar["avg_volume"]) else np.nan,
        "atr": atr,
        "stop_price": float(stop),
        "stop_source": stop_source,
        "target_price": float(target),
        "risk_per_share": float(risk_per_share),
        "shares": shares,
    }


def check_exit(pos, bar, ts):
    """Resolve this bar against the open position.

    Returns ``(raw_exit_price, reason, is_market_order)`` or None.

    Sequencing rules, in order:
      1. 15:55 flat-time beats everything -- no overnight risk.
      2. A bar that OPENS through the stop fills at the open (gap, worse than
         the stop).  You cannot get your stop price that isn't there.
      3. A bar that OPENS through the target fills at the target: your resting
         limit was already in the book, so the stop-first rule must not steal
         a trade that was profitable before the bar's low was made.
      4. Otherwise, if the bar's range covers the stop, the stop is hit --
         and it is checked BEFORE the target, so a bar covering both is
         scored as a loss.  This is the conservative assumption required
         because 5-minute bars carry no intrabar sequence.
    """
    direction, stop, target = pos["direction"], pos["stop_price"], pos["target_price"]

    if ts.time() >= EOD_FLAT:
        return float(bar["open"]), "eod_time_exit", True

    if direction == "long":
        if bar["open"] <= stop:
            return float(bar["open"]), "stop_gap", True
        if bar["open"] >= target:
            return float(target), "target_gap", False
        if bar["low"] <= stop:
            return float(stop), "stop", True
        if bar["high"] >= target:
            return float(target), "target", False
    else:
        if bar["open"] >= stop:
            return float(bar["open"]), "stop_gap", True
        if bar["open"] <= target:
            return float(target), "target_gap", False
        if bar["high"] >= stop:
            return float(stop), "stop", True
        if bar["low"] <= target:
            return float(target), "target", False
    return None


def close_position(pos, raw_exit, exit_time, reason, is_market) -> dict:
    """Finish a trade and price it, gross and net of every cost."""
    direction, shares = pos["direction"], pos["shares"]
    sign = 1.0 if direction == "long" else -1.0

    exit_fill = _market_fill(raw_exit, direction, "exit") if is_market else float(raw_exit)

    gross = (raw_exit - pos["raw_entry"]) * shares * sign        # frictionless
    commission = 2 * _commission(shares)                         # entry + exit
    net = (exit_fill - pos["entry_price"]) * shares * sign - commission

    risk_dollars = pos["risk_per_share"] * shares
    trade = dict(pos)
    trade.update(
        {
            "exit_time": exit_time,
            "raw_exit": float(raw_exit),
            "exit_price": float(exit_fill),
            "exit_reason": reason,
            "commission": commission,
            "risk_dollars": risk_dollars,
            "gross_pnl": float(gross),
            "net_pnl": float(net),
            "r_multiple": float(net / risk_dollars) if risk_dollars else np.nan,
            "bars_held": np.nan,
        }
    )
    return trade


def simulate_day(day_bars: pd.DataFrame, symbol: str, cfg: Config) -> list:
    """Walk one session bar by bar.  Strictly forward in time, no peeking."""
    opening_range = compute_opening_range(day_bars)
    if opening_range is None:
        return []
    orh, orl = opening_range

    trades, position, pending = [], None, None
    long_used = short_used = False
    stamps = day_bars.index
    n = len(day_bars)

    for i in range(n):
        ts = stamps[i]
        bar = day_bars.iloc[i]

        # --- A. fill an order that was sent at the previous bar's close ----
        if pending is not None:
            position = open_position(
                symbol, pending["direction"], pending["signal_bar"], pending["signal_time"],
                float(bar["open"]), ts, orh, orl, cfg,
            )
            pending = None
            if position is not None:
                position["entry_index"] = i
                position["check_from"] = i          # entry bar can also exit us

        # --- B. manage an open position -----------------------------------
        if position is not None and i >= position["check_from"]:
            outcome = check_exit(position, bar, ts)
            if outcome is not None:
                raw_exit, reason, is_market = outcome
                trade = close_position(position, raw_exit, ts, reason, is_market)
                trade["bars_held"] = i - position["entry_index"]
                trades.append(trade)
                position = None

        # --- C. look for a new signal on this CLOSED bar -------------------
        if position is None and pending is None and ts.time() >= OR_END:
            direction = evaluate_signal(bar, orh, orl, cfg)
            already_used = (direction == "long" and long_used) or \
                           (direction == "short" and short_used)
            if direction is not None and not already_used:
                if cfg.entry_on == "signal_close":
                    # Fill at this bar's close; exits start on the NEXT bar.
                    if ts.time() < LAST_ENTRY:
                        position = open_position(
                            symbol, direction, bar, ts, float(bar["close"]), ts, orh, orl, cfg,
                        )
                        if position is not None:
                            position["entry_index"] = i
                            position["check_from"] = i + 1
                            long_used |= direction == "long"
                            short_used |= direction == "short"
                else:
                    # Default: fill at the next bar's open.  The entry clock is
                    # checked against the FILL time, not the signal time.
                    if i + 1 < n and stamps[i + 1].time() < LAST_ENTRY:
                        pending = {"direction": direction, "signal_bar": bar, "signal_time": ts}
                        long_used |= direction == "long"
                        short_used |= direction == "short"

    # --- D. never hold overnight: flatten on the last print of the day -----
    if position is not None:
        last_ts, last_bar = stamps[n - 1], day_bars.iloc[n - 1]
        trade = close_position(position, float(last_bar["close"]), last_ts,
                               "eod_last_bar", True)
        trade["bars_held"] = (n - 1) - position["entry_index"]
        trades.append(trade)

    return trades


def run_backtest(data: dict, cfg: Config) -> pd.DataFrame:
    """Run one variant over every ticker and session."""
    rows = []
    for symbol, df in data.items():
        for _, day_bars in df.groupby("session", sort=True):
            rows.extend(simulate_day(day_bars, symbol, cfg))

    if not rows:
        return pd.DataFrame(columns=TRADE_COLUMNS)

    trades = pd.DataFrame(rows)
    trades["version"] = cfg.version
    trades["target"] = cfg.target_name
    trades["date"] = pd.to_datetime(trades["session"])
    trades["entry_clock"] = trades["entry_time"].apply(lambda t: t.strftime("%H:%M"))
    trades["day_of_week"] = trades["date"].dt.day_name()
    trades["month"] = trades["date"].dt.strftime("%b")
    trades["month_num"] = trades["date"].dt.month
    trades["year"] = trades["date"].dt.year
    trades["year_month"] = trades["date"].dt.to_period("M").astype(str)
    return trades.sort_values("entry_time").reset_index(drop=True)


TRADE_COLUMNS = [
    "ticker", "date", "direction", "entry_time", "entry_price", "or_high", "or_low",
    "vwap", "volume", "avg_volume_20", "atr", "stop_price", "stop_source",
    "target_price", "exit_time", "exit_price", "exit_reason", "shares",
    "commission", "gross_pnl", "net_pnl", "r_multiple",
]


# ==========================================================================
# 6. CALCULATING STATISTICS
# ==========================================================================
def daily_pnl_series(trades: pd.DataFrame, sessions: pd.DatetimeIndex) -> pd.Series:
    """Net P&L per calendar session, zero-filled on days with no trade.

    Zero-filling matters: Sharpe computed only over traded days silently
    inflates the ratio by deleting the flat days that a real account lives
    through.
    """
    empty = pd.Series(0.0, index=pd.DatetimeIndex(sessions).normalize())
    if trades.empty:
        return empty
    by_day = trades.groupby(trades["date"].dt.normalize())["net_pnl"].sum()
    return empty.add(by_day, fill_value=0.0).sort_index()


def max_drawdown(equity: pd.Series):
    """Worst peak-to-trough decline of the equity curve, in $ and in %."""
    if equity.empty:
        return 0.0, 0.0
    running_peak = equity.cummax()
    drawdown = equity - running_peak
    dd_dollars = float(drawdown.min())
    dd_pct = float((drawdown / running_peak.replace(0, np.nan)).min() * 100)
    return abs(dd_dollars), abs(dd_pct if np.isfinite(dd_pct) else 0.0)


def max_consecutive_losses(trades: pd.DataFrame) -> int:
    """Longest run of losing trades in chronological order."""
    if trades.empty:
        return 0
    worst = run = 0
    for pnl in trades.sort_values("exit_time")["net_pnl"]:
        run = run + 1 if pnl < 0 else 0
        worst = max(worst, run)
    return worst


def compute_stats(trades: pd.DataFrame, sessions, label: str = "") -> dict:
    """Every performance metric for one slice of trades."""
    stats = {
        "label": label, "trades": int(len(trades)), "wins": 0, "losses": 0,
        "win_rate_pct": np.nan, "avg_win": np.nan, "avg_loss": np.nan,
        "avg_r": np.nan, "expectancy": np.nan, "expectancy_r": np.nan,
        "net_profit": 0.0, "gross_profit": 0.0, "gross_loss": 0.0,
        "profit_factor": np.nan, "max_drawdown": 0.0, "max_drawdown_pct": 0.0,
        "max_consec_losses": 0, "sharpe": np.nan, "total_r": 0.0,
        "commission_paid": 0.0, "long_trades": 0, "long_net": 0.0,
        "long_win_rate_pct": np.nan, "long_avg_r": np.nan,
        "short_trades": 0, "short_net": 0.0, "short_win_rate_pct": np.nan,
        "short_avg_r": np.nan, "target_hit_pct": np.nan, "stop_hit_pct": np.nan,
        "time_exit_pct": np.nan, "atr_stop_pct": np.nan,
    }
    if trades.empty:
        return stats

    pnl = trades["net_pnl"]
    wins, losses = trades[pnl > 0], trades[pnl < 0]

    stats["wins"], stats["losses"] = len(wins), len(losses)
    stats["win_rate_pct"] = 100.0 * len(wins) / len(trades)
    stats["avg_win"] = float(wins["net_pnl"].mean()) if len(wins) else 0.0
    stats["avg_loss"] = float(losses["net_pnl"].mean()) if len(losses) else 0.0
    stats["avg_r"] = float(trades["r_multiple"].mean())
    stats["total_r"] = float(trades["r_multiple"].sum())
    stats["expectancy"] = float(pnl.mean())          # $ per trade
    stats["expectancy_r"] = stats["avg_r"]           # R per trade
    stats["net_profit"] = float(pnl.sum())
    stats["gross_profit"] = float(wins["net_pnl"].sum()) if len(wins) else 0.0
    stats["gross_loss"] = float(abs(losses["net_pnl"].sum())) if len(losses) else 0.0
    stats["profit_factor"] = (
        stats["gross_profit"] / stats["gross_loss"] if stats["gross_loss"] > 0
        else (np.inf if stats["gross_profit"] > 0 else np.nan)
    )
    stats["commission_paid"] = float(trades["commission"].sum())
    stats["max_consec_losses"] = max_consecutive_losses(trades)

    # Equity, drawdown and Sharpe on a DAILY grid (flat days included).
    daily = daily_pnl_series(trades, sessions)
    equity = STARTING_EQUITY + daily.cumsum()
    stats["max_drawdown"], stats["max_drawdown_pct"] = max_drawdown(equity)

    returns = daily / STARTING_EQUITY
    if len(returns) > 1 and returns.std(ddof=1) > 0:
        stats["sharpe"] = float(
            returns.mean() / returns.std(ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR)
        )

    for side in ("long", "short"):
        sub = trades[trades["direction"] == side]
        stats[f"{side}_trades"] = len(sub)
        if len(sub):
            stats[f"{side}_net"] = float(sub["net_pnl"].sum())
            stats[f"{side}_win_rate_pct"] = 100.0 * (sub["net_pnl"] > 0).mean()
            stats[f"{side}_avg_r"] = float(sub["r_multiple"].mean())

    reason = trades["exit_reason"]
    stats["target_hit_pct"] = 100.0 * reason.str.startswith("target").mean()
    stats["stop_hit_pct"] = 100.0 * reason.str.startswith("stop").mean()
    stats["time_exit_pct"] = 100.0 * reason.str.startswith("eod").mean()
    stats["atr_stop_pct"] = 100.0 * (trades["stop_source"] == "atr").mean()
    return stats


def breakdown(trades: pd.DataFrame, key: str, sessions) -> pd.DataFrame:
    """Summarise trades grouped by ``key`` (day of week, month, year, ...)."""
    if trades.empty:
        return pd.DataFrame()
    rows = []
    for value, sub in trades.groupby(key, sort=True):
        s = compute_stats(sub, sessions, label=str(value))
        rows.append(
            {
                key: value, "trades": s["trades"], "win_rate_pct": s["win_rate_pct"],
                "net_profit": s["net_profit"], "avg_r": s["avg_r"],
                "expectancy": s["expectancy"], "profit_factor": s["profit_factor"],
            }
        )
    out = pd.DataFrame(rows)
    # Calendar order, not alphabetical -- "Apr, Aug, Dec" reads as nonsense.
    orders = {
        "day_of_week": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "month": ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    }
    if key in orders:
        out["__o"] = out[key].map({v: i for i, v in enumerate(orders[key])})
        out = out.sort_values("__o").drop(columns="__o")
    return out.reset_index(drop=True)


# ==========================================================================
# 7. OUT-OF-SAMPLE SPLIT
# ==========================================================================
def split_sessions(sessions: pd.DatetimeIndex, fraction: float = IN_SAMPLE_FRACTION):
    """Chronological 70/30 split of the session calendar.

    The split is on DATES, shared by every ticker and every variant, so no
    variant gets a different amount of development data.  Nothing in this
    script fits parameters, so the out-of-sample block stays genuinely
    untouched -- it is a holdout, and it only stays one if you resist
    re-running the study after peeking at it.
    """
    sessions = pd.DatetimeIndex(sorted(pd.DatetimeIndex(sessions).normalize().unique()))
    if len(sessions) < 10:
        return sessions, pd.DatetimeIndex([]), None
    cut = int(len(sessions) * fraction)
    return sessions[:cut], sessions[cut:], sessions[cut]


def slice_trades(trades: pd.DataFrame, sessions: pd.DatetimeIndex) -> pd.DataFrame:
    """Trades whose session date falls inside ``sessions``."""
    if trades.empty or len(sessions) == 0:
        return trades.iloc[0:0]
    return trades[trades["date"].dt.normalize().isin(sessions)]


# ==========================================================================
# 8. PLOTTING RESULTS
# ==========================================================================
def plot_results(trades: pd.DataFrame, sessions, label: str, outdir: str, boundary=None):
    """Equity curve, drawdown, cumulative R and monthly P&L in one figure."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if trades.empty:
        return None

    daily = daily_pnl_series(trades, sessions)
    equity = STARTING_EQUITY + daily.cumsum()
    drawdown = equity - equity.cummax()

    fig, axes = plt.subplots(2, 2, figsize=(15, 9))
    fig.suptitle(f"ORB {label}", fontsize=14, fontweight="bold")

    ax = axes[0][0]
    ax.plot(equity.index, equity.values, lw=1.3, color="#1f77b4")
    ax.axhline(STARTING_EQUITY, color="grey", ls="--", lw=0.8)
    if boundary is not None:
        ax.axvline(boundary, color="crimson", ls=":", lw=1.4)
        ax.text(boundary, equity.max(), " out-of-sample >", color="crimson", fontsize=8, va="top")
    ax.set_title("Equity curve (net)")
    ax.set_ylabel("Account $")
    ax.grid(alpha=0.3)

    ax = axes[0][1]
    ax.fill_between(drawdown.index, drawdown.values, 0, color="#d62728", alpha=0.4)
    ax.set_title(f"Drawdown (max ${abs(drawdown.min()):,.0f})")
    ax.set_ylabel("$ below peak")
    ax.grid(alpha=0.3)

    ax = axes[1][0]
    ordered = trades.sort_values("exit_time")
    ax.plot(range(1, len(ordered) + 1), ordered["r_multiple"].cumsum().values,
            lw=1.3, color="#2ca02c")
    ax.axhline(0, color="grey", ls="--", lw=0.8)
    ax.set_title("Cumulative R")
    ax.set_xlabel("Trade number")
    ax.set_ylabel("R")
    ax.grid(alpha=0.3)

    ax = axes[1][1]
    monthly = trades.groupby("year_month")["net_pnl"].sum()
    colors = ["#2ca02c" if v >= 0 else "#d62728" for v in monthly.values]
    ax.bar(range(len(monthly)), monthly.values, color=colors)
    step = max(1, len(monthly) // 12)
    ax.set_xticks(range(0, len(monthly), step))
    ax.set_xticklabels(monthly.index[::step], rotation=90, fontsize=7)
    ax.axhline(0, color="grey", lw=0.8)
    ax.set_title("Monthly net P&L")
    ax.set_ylabel("$")
    ax.grid(alpha=0.3, axis="y")

    fig.tight_layout()
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, f"charts_{label.replace('@', '_')}.png")
    fig.savefig(path, dpi=120)
    plt.close(fig)
    return path


# ==========================================================================
# 9. COMPARISON + OVERFITTING CHECK
# ==========================================================================
def rank_variants(summary: pd.DataFrame) -> pd.DataFrame:
    """Rank the 8 variants on five axes -- deliberately NOT on net profit.

    Net profit rewards whichever variant happened to size into the luckiest
    tail.  Profit factor, expectancy, drawdown, sample size and Sharpe
    together describe whether an edge is real, repeatable and survivable.
    """
    port = summary[(summary["ticker"] == "ALL") & (summary["scope"] == "FULL")].copy()
    if port.empty:
        return port

    port["pf_rank"] = port["profit_factor"].rank(ascending=False)
    port["exp_rank"] = port["expectancy"].rank(ascending=False)
    port["dd_rank"] = port["max_drawdown"].rank(ascending=True)     # smaller is better
    port["trades_rank"] = port["trades"].rank(ascending=False)      # more = more evidence
    port["sharpe_rank"] = port["sharpe"].rank(ascending=False)

    rank_cols = ["pf_rank", "exp_rank", "dd_rank", "trades_rank", "sharpe_rank"]
    port["composite_rank"] = port[rank_cols].mean(axis=1)
    port["enough_trades"] = port["trades"] >= MIN_TRADES_FOR_RANKING
    return port.sort_values(["enough_trades", "composite_rank"],
                            ascending=[False, True]).reset_index(drop=True)


def overfitting_report(summary: pd.DataFrame) -> pd.DataFrame:
    """Flag variants that look good in-sample and fall apart out-of-sample."""
    port = summary[summary["ticker"] == "ALL"]
    rows = []
    for (version, target), grp in port.groupby(["version", "target"]):
        ins = grp[grp["scope"] == "IS"]
        oos = grp[grp["scope"] == "OOS"]
        if ins.empty or oos.empty:
            continue
        i, o = ins.iloc[0], oos.iloc[0]
        looked_good = (i["profit_factor"] > 1.10) and (i["expectancy"] > 0)
        held_up = (o["profit_factor"] > 1.00) and (o["expectancy"] > 0)
        if o["trades"] < MIN_TRADES_FOR_RANKING:
            verdict = "too few OOS trades to judge"
        elif looked_good and not held_up:
            verdict = "POTENTIAL OVERFIT (IS good, OOS fails)"
        elif looked_good and held_up:
            verdict = "holds up out-of-sample"
        elif not looked_good and held_up:
            verdict = "weak IS, better OOS (likely noise)"
        else:
            verdict = "no edge in either period"
        rows.append(
            {
                "version": version, "target": target,
                "is_trades": i["trades"], "is_pf": i["profit_factor"],
                "is_expectancy": i["expectancy"], "is_avg_r": i["avg_r"],
                "oos_trades": o["trades"], "oos_pf": o["profit_factor"],
                "oos_expectancy": o["expectancy"], "oos_avg_r": o["avg_r"],
                "expectancy_decay": o["expectancy"] - i["expectancy"],
                "verdict": verdict,
            }
        )
    return pd.DataFrame(rows)


# ==========================================================================
# 10. EXPORTING RESULTS
# ==========================================================================
def export_results(all_trades, summary, comparison, oos_table, breakdowns, outdir):
    """Write every table to CSV.  These files are the deliverable."""
    os.makedirs(outdir, exist_ok=True)
    written = []

    def _write(df, name):
        if df is None or len(df) == 0:
            return
        path = os.path.join(outdir, name)
        df.to_csv(path, index=False)
        written.append(path)

    if len(all_trades):
        log = all_trades.copy()
        ordered = ["version", "target"] + TRADE_COLUMNS + [
            "signal_time", "stop_source", "risk_per_share", "risk_dollars",
            "bars_held", "day_of_week", "month", "year", "entry_clock",
        ]
        cols = [c for c in dict.fromkeys(ordered) if c in log.columns]
        _write(log[cols], "trade_log.csv")

    _write(summary, "strategy_summary.csv")
    _write(comparison, "version_comparison.csv")
    _write(oos_table, "in_vs_out_of_sample.csv")
    for name, df in breakdowns.items():
        _write(df, f"breakdown_{name}.csv")
    return written


# ==========================================================================
# 11. REPORTING
# ==========================================================================
def _fmt(df: pd.DataFrame, cols=None) -> str:
    view = df[cols] if cols else df
    return view.to_string(index=False, float_format=lambda v: f"{v:,.2f}")


def summarise_variant(trades, sessions, is_sessions, oos_sessions, cfg, symbols) -> list:
    """Stats rows for one variant: every ticker x every sample window."""
    rows = []
    scopes = [("FULL", sessions), ("IS", is_sessions), ("OOS", oos_sessions)]
    for ticker in list(symbols) + ["ALL"]:
        subset = trades if ticker == "ALL" else trades[trades["ticker"] == ticker]
        for scope_name, scope_sessions in scopes:
            if len(scope_sessions) == 0:
                continue
            sliced = slice_trades(subset, scope_sessions)
            stats = compute_stats(sliced, scope_sessions,
                                  label=f"{cfg.label}|{ticker}|{scope_name}")
            stats.update({"version": cfg.version, "target": cfg.target_name,
                          "ticker": ticker, "scope": scope_name})
            rows.append(stats)
    return rows


HEADLINE = ["ticker", "trades", "win_rate_pct", "avg_win", "avg_loss", "avg_r",
            "expectancy", "net_profit", "profit_factor", "max_drawdown",
            "max_consec_losses", "sharpe", "long_trades", "long_net",
            "short_trades", "short_net"]


def print_report(summary, comparison, oos_table, breakdowns, symbols, synthetic):
    """Everything to the console, in the order a trader would read it."""
    line = "=" * 100
    if synthetic:
        print("\n" + "!" * 100)
        print("SYNTHETIC DATA -- these numbers test the CODE, not the market. Not results.")
        print("!" * 100)

    for target in TARGETS:
        print(f"\n{line}\nPRIMARY STRATEGY ({PRIMARY_VERSION}) -- {target} target -- full dataset\n{line}")
        view = summary[(summary["version"] == PRIMARY_VERSION) &
                       (summary["target"] == target) & (summary["scope"] == "FULL")]
        if len(view):
            print(_fmt(view, HEADLINE))

    print(f"\n{line}\nVERSION COMPARISON (portfolio, full dataset)\n{line}")
    print("Ranked by the AVERAGE of five ranks: profit factor, expectancy,")
    print("max drawdown, trade count and Sharpe. Net profit is deliberately excluded.\n")
    if len(comparison):
        cols = ["version", "target", "trades", "profit_factor", "expectancy", "avg_r",
                "max_drawdown", "sharpe", "net_profit", "composite_rank", "enough_trades"]
        print(_fmt(comparison, [c for c in cols if c in comparison.columns]))

    print(f"\n{line}\nIN-SAMPLE vs OUT-OF-SAMPLE (portfolio)\n{line}")
    if len(oos_table):
        print(_fmt(oos_table))
        flagged = oos_table[oos_table["verdict"].str.startswith("POTENTIAL OVERFIT")]
        if len(flagged):
            print("\n  >> Flagged as potential overfitting:")
            for _, r in flagged.iterrows():
                print(f"     - {r['version']}@{r['target']}: IS PF {r['is_pf']:.2f} -> OOS PF {r['oos_pf']:.2f}")

    for name, df in breakdowns.items():
        if len(df):
            print(f"\n{line}\nBREAKDOWN BY {name.upper().replace('_', ' ')} "
                  f"({PRIMARY_VERSION}, full dataset)\n{line}")
            print(_fmt(df))


# ==========================================================================
# 12. MAIN
# ==========================================================================
def parse_args():
    p = argparse.ArgumentParser(
        description="Opening Range Breakout backtester (SPY/QQQ/IWM, 5-minute bars)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--symbols", nargs="+", default=["SPY", "QQQ", "IWM"])
    p.add_argument("--provider", default="yahoo", choices=sorted(ds.PROVIDERS),
                   help="yahoo caps at ~60 days; use alpaca/polygon/databento/ibkr for years")
    p.add_argument("--years", type=float, default=5.0, help="lookback length in years")
    p.add_argument("--start", default=None, help="YYYY-MM-DD (overrides --years)")
    p.add_argument("--end", default=None, help="YYYY-MM-DD")
    p.add_argument("--risk", type=float, default=RISK_PER_TRADE, help="$ risked per trade")
    p.add_argument("--entry-on", default="next_open", choices=["next_open", "signal_close"])
    p.add_argument("--atr-mode", default="continuous", choices=["continuous", "session"])
    p.add_argument("--outdir", default="results")
    p.add_argument("--cache-dir", default="data/cache")
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--no-plots", action="store_true")
    p.add_argument("--plot-all", action="store_true", help="chart every variant, not just the primary")
    return p.parse_args()


def main():
    args = parse_args()
    end = pd.Timestamp(args.end) if args.end else pd.Timestamp.now(tz=ds.MARKET_TZ).normalize()
    start = pd.Timestamp(args.start) if args.start else end - pd.Timedelta(days=int(args.years * 365.25))

    print("=" * 100)
    print(f"ORB BACKTEST  |  {', '.join(args.symbols)}  |  {BAR_MINUTES}-minute bars")
    print(f"Provider: {args.provider}   Requested window: {pd.Timestamp(start).date()} -> {pd.Timestamp(end).date()}")
    print(f"Entry: {args.entry_on}   ATR: {args.atr_mode}   Risk/trade: ${args.risk:,.0f}")
    print(f"Costs: ${COMMISSION_PER_SHARE}/share (min ${MIN_COMMISSION_ORDER}/order), "
          f"half-spread ${HALF_SPREAD}, slippage ${SLIPPAGE_PER_SHARE}")
    print("=" * 100)

    # ---- load ------------------------------------------------------------
    data = {}
    for symbol in args.symbols:
        df = load_symbol_data(symbol, start, end, args.provider,
                              args.cache_dir, use_cache=not args.no_cache)
        if df.empty:
            print(f"  {symbol}: NO DATA -- skipped")
            continue
        df = add_indicators(df, atr_mode=args.atr_mode)
        data[symbol] = df
        print(f"  {symbol}: {len(df):,} RTH bars, {df['session'].nunique():,} sessions "
              f"({df.index.min().date()} -> {df.index.max().date()})")

    if not data:
        print("\nNo data loaded. Nothing was backtested, and no results will be invented.")
        print("Fix the data source (see --provider) and re-run.")
        return 1

    sessions = pd.DatetimeIndex(
        sorted({pd.Timestamp(d) for df in data.values() for d in df["session"].unique()})
    )
    is_sessions, oos_sessions, boundary = split_sessions(sessions)
    span_years = max((sessions[-1] - sessions[0]).days / 365.25, 0.01)
    print(f"\n  Sessions: {len(sessions):,} ({span_years:.2f} years)")
    print(f"  In-sample:     {len(is_sessions):,} sessions "
          f"({is_sessions[0].date()} -> {is_sessions[-1].date()})" if len(is_sessions) else "")
    print(f"  Out-of-sample: {len(oos_sessions):,} sessions "
          f"({oos_sessions[0].date()} -> {oos_sessions[-1].date()})" if len(oos_sessions) else "")
    if span_years < 1.5:
        print("\n  WARNING: under ~2 years of history. Treat every number below as a")
        print("  code check, not evidence. Re-run with a multi-year provider.")

    # ---- how much work is each filter really doing? ----------------------
    diagnostics = filter_diagnostics(data)
    print("\nFilter pass rates on raw breakout candles (09:45-11:00):")
    print(_fmt(diagnostics))

    # ---- run every variant ----------------------------------------------
    print("\nRunning 4 versions x 2 targets ...")
    trade_frames, summary_rows = [], []
    for version in VERSIONS:
        for target_name in TARGETS:
            cfg = Config.build(version, target_name,
                               atr_mode=args.atr_mode, entry_on=args.entry_on,
                               risk_per_trade=args.risk)
            trades = run_backtest(data, cfg)
            trade_frames.append(trades)
            summary_rows.extend(
                summarise_variant(trades, sessions, is_sessions, oos_sessions, cfg, args.symbols)
            )
            print(f"  {cfg.label:<28} {len(trades):>5} trades")

    all_trades = pd.concat([t for t in trade_frames if len(t)], ignore_index=True) \
        if any(len(t) for t in trade_frames) else pd.DataFrame(columns=TRADE_COLUMNS)
    summary = pd.DataFrame(summary_rows)

    if all_trades.empty:
        print("\nNo trades were generated -- check the data window and filters.")
        return 1

    # ---- comparison, holdout, breakdowns --------------------------------
    comparison = rank_variants(summary)
    oos_table = overfitting_report(summary)

    primary = all_trades[(all_trades["version"] == PRIMARY_VERSION) &
                         (all_trades["target"] == "1.5R")]
    breakdowns = {
        key: breakdown(primary, key, sessions)
        for key in ["day_of_week", "month", "year", "entry_clock", "direction", "ticker"]
    }

    # ---- charts ----------------------------------------------------------
    if not args.no_plots:
        print("\nCharts:")
        for frame in trade_frames:
            if frame.empty:
                continue
            version, target = frame["version"].iloc[0], frame["target"].iloc[0]
            if not args.plot_all and version != PRIMARY_VERSION:
                continue
            path = plot_results(frame, sessions, f"{version}@{target}", args.outdir, boundary)
            if path:
                print(f"  {path}")

    # ---- export + report -------------------------------------------------
    written = export_results(all_trades, summary, comparison, oos_table, breakdowns, args.outdir)
    diagnostics.to_csv(os.path.join(args.outdir, "filter_diagnostics.csv"), index=False)
    written.append(os.path.join(args.outdir, "filter_diagnostics.csv"))
    print_report(summary, comparison, oos_table, breakdowns, args.symbols,
                 synthetic=(args.provider == "synthetic"))

    print("\nFiles written:")
    for path in written:
        print(f"  {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
