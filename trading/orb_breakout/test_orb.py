#!/usr/bin/env python3
"""Correctness tests for the ORB engine.

These are the review items from the spec turned into assertions: look-ahead
bias, candle timing, VWAP, ATR, execution realism and timezone handling.
Run with ``python test_orb.py`` (no pytest required).
"""

from __future__ import annotations

from datetime import time as dtime

import numpy as np
import pandas as pd

import orb_backtest as ob
from data_sources import MARKET_TZ

PASS, FAIL = [], []


def check(name, condition, detail=""):
    (PASS if condition else FAIL).append(name)
    print(f"  [{'PASS' if condition else 'FAIL'}] {name}{('  -- ' + detail) if detail and not condition else ''}")


def make_day(date="2024-03-15", bars=None, base=100.0, n=78):
    """Build one synthetic RTH session with explicit control over the bars.

    ``bars`` maps 'HH:MM' -> (open, high, low, close, volume) to override.
    """
    stamps = pd.date_range(f"{date} 09:30", periods=n, freq="5min", tz=MARKET_TZ)
    rows = []
    for ts in stamps:
        rows.append({"timestamp": ts, "open": base, "high": base + 0.05,
                     "low": base - 0.05, "close": base, "volume": 10_000.0})
    df = pd.DataFrame(rows).set_index("timestamp")
    for clock, vals in (bars or {}).items():
        key = pd.Timestamp(f"{date} {clock}", tz=MARKET_TZ)
        df.loc[key, ["open", "high", "low", "close", "volume"]] = vals
    df["session"] = df.index.date
    return df


def prep(df):
    return ob.add_indicators(df)


def prep_warm(df):
    """Indicators with a preceding session, so ATR(14) is warmed up.

    Without this, a breakout in the first 13 bars of the very first session
    has no ATR yet and the engine correctly refuses the trade -- which is the
    right behaviour, but not what these tests are trying to exercise.
    """
    first = pd.Timestamp(df.index[0].date())
    warm = make_day(str((first - pd.Timedelta(days=3)).date()),
                    base=float(df["open"].iloc[0]))
    full = ob.add_indicators(pd.concat([warm, df]))
    return full.loc[full["session"] == df.index[0].date()]


# --------------------------------------------------------------------------
print("\n1. Opening range window (09:30-09:45 only)")
# --------------------------------------------------------------------------
day = make_day(bars={
    "09:30": (100, 101.0, 99.5, 100.5, 20000),   # OR high 101.0
    "09:35": (100.5, 100.8, 99.0, 100.0, 20000), # OR low  99.0
    "09:40": (100.0, 100.6, 99.8, 100.2, 20000),
    "09:45": (100.2, 105.0, 95.0, 100.2, 20000), # AFTER the OR: must not count
})
rng = ob.compute_opening_range(day)
check("OR high is the max of 09:30/09:35/09:40 only", rng is not None and abs(rng[0] - 101.0) < 1e-9,
      f"got {rng}")
check("OR low is the min of 09:30/09:35/09:40 only", rng is not None and abs(rng[1] - 99.0) < 1e-9,
      f"got {rng}")
check("partial opening range is rejected", ob.compute_opening_range(day.iloc[:2]) is None)


# --------------------------------------------------------------------------
print("\n2. VWAP is session-anchored and correct")
# --------------------------------------------------------------------------
day = make_day()
d = prep(day)
typical = (day["high"] + day["low"] + day["close"]) / 3
manual = (typical * day["volume"]).cumsum() / day["volume"].cumsum()
check("VWAP matches manual cumulative (TP*V)/V", np.allclose(d["vwap"].values, manual.values))

two = pd.concat([make_day("2024-03-15", base=100.0), make_day("2024-03-18", base=200.0)])
d2 = prep(two)
first_bar_day2 = d2.loc[d2["session"] == pd.Timestamp("2024-03-18").date()].iloc[0]
check("VWAP resets each session (day 2 bar 1 == its own typical price)",
      abs(first_bar_day2["vwap"] - 200.0) < 0.05, f"got {first_bar_day2['vwap']}")


# --------------------------------------------------------------------------
print("\n3. ATR is Wilder's and gap-safe")
# --------------------------------------------------------------------------
d2 = prep(two)
day2_mask = d2["session"] == pd.Timestamp("2024-03-18").date()
first_tr = d2.loc[day2_mask, "true_range"].iloc[0]
check("first bar of a session uses high-low, not the overnight gap",
      abs(first_tr - 0.10) < 1e-9, f"true_range={first_tr} (gap was 100 pts)")

tr = d2["true_range"]
manual_atr = tr.ewm(alpha=1 / ob.ATR_PERIOD, adjust=False, min_periods=ob.ATR_PERIOD).mean()
check("ATR equals Wilder smoothing (alpha=1/14)", np.allclose(
    d2["atr"].dropna().values, manual_atr.dropna().values))
check("ATR is NaN before it is warmed up", bool(d2["atr"].iloc[:ob.ATR_PERIOD - 1].isna().all()))


# --------------------------------------------------------------------------
print("\n4. Average volume excludes the current bar (no self-reference)")
# --------------------------------------------------------------------------
d = prep(make_day())
i = 40
manual_avg = d["volume"].iloc[i - ob.VOL_LOOKBACK:i].mean()
check("avg_volume[i] == mean(volume[i-20:i])", abs(d["avg_volume"].iloc[i] - manual_avg) < 1e-9)


# --------------------------------------------------------------------------
print("\n5. No look-ahead: the fill is the NEXT bar's open")
# --------------------------------------------------------------------------
day = make_day(bars={
    "09:30": (100, 100.5, 99.5, 100.0, 20000),
    "09:35": (100, 100.5, 99.5, 100.0, 20000),
    "09:40": (100, 100.5, 99.5, 100.0, 20000),
    "10:00": (100, 101.0, 99.9, 101.0, 90000),   # breakout close above OR high 100.5
    "10:05": (100.7, 100.9, 100.6, 100.8, 50000),# fill must happen HERE, at 100.70
})
cfg = ob.Config.build("A_orb_only", "1.5R")
trades = ob.simulate_day(prep_warm(day), "TEST", cfg)
check("exactly one trade generated", len(trades) == 1, f"got {len(trades)}")
if trades:
    t = trades[0]
    expected = 100.70 + ob.HALF_SPREAD + ob.SLIPPAGE_PER_SHARE
    check("entry price == next bar's open + spread + slippage",
          abs(t["entry_price"] - expected) < 1e-9, f"got {t['entry_price']} want {expected}")
    check("entry timestamp is the bar AFTER the signal",
          t["entry_time"] == pd.Timestamp("2024-03-15 10:05", tz=MARKET_TZ), str(t["entry_time"]))
    check("signal bar precedes the entry bar", t["signal_time"] < t["entry_time"])
    check("stop is below entry for a long", t["stop_price"] < t["entry_price"])
    check("indicators are read from the signal bar (volume 90000)", t["volume"] == 90000)

# The same day WITHOUT a warm-up session must produce no trade: ATR(14) is not
# available on bar 6, and the engine must stand aside rather than guess.
check("no trade when the session starts cold (ATR not warmed up)",
      len(ob.simulate_day(prep(day), "TEST", cfg)) == 0)


# --------------------------------------------------------------------------
print("\n6. Stop wins when one bar spans both stop and target")
# --------------------------------------------------------------------------
pos = {"direction": "long", "stop_price": 99.0, "target_price": 102.0}
bar = pd.Series({"open": 100.0, "high": 103.0, "low": 98.0, "close": 100.0})
raw, reason, _ = ob.check_exit(pos, bar, pd.Timestamp("2024-03-15 10:30", tz=MARKET_TZ))
check("long: stop-first on an outside bar", reason == "stop" and raw == 99.0, f"{reason}@{raw}")

pos = {"direction": "short", "stop_price": 101.0, "target_price": 98.0}
raw, reason, _ = ob.check_exit(pos, bar, pd.Timestamp("2024-03-15 10:30", tz=MARKET_TZ))
check("short: stop-first on an outside bar", reason == "stop" and raw == 101.0, f"{reason}@{raw}")

# a gap THROUGH the stop cannot fill at the stop price
pos = {"direction": "long", "stop_price": 99.0, "target_price": 102.0}
gap = pd.Series({"open": 97.0, "high": 103.0, "low": 96.0, "close": 97.0})
raw, reason, mkt = ob.check_exit(pos, gap, pd.Timestamp("2024-03-15 10:30", tz=MARKET_TZ))
check("gap through the stop fills at the open, worse than the stop",
      reason == "stop_gap" and raw == 97.0 and mkt, f"{reason}@{raw}")


# --------------------------------------------------------------------------
print("\n7. Trading restrictions")
# --------------------------------------------------------------------------
# (a) no new entries at or after 11:00
day = make_day(bars={
    "09:30": (100, 100.5, 99.5, 100.0, 20000),
    "09:35": (100, 100.5, 99.5, 100.0, 20000),
    "09:40": (100, 100.5, 99.5, 100.0, 20000),
    "10:55": (100, 101.0, 99.9, 101.0, 90000),   # signal -> fill 11:00 = TOO LATE
})
check("no fill at or after 11:00", len(ob.simulate_day(prep_warm(day), "TEST", cfg)) == 0)

day = make_day(bars={
    "09:30": (100, 100.5, 99.5, 100.0, 20000),
    "09:35": (100, 100.5, 99.5, 100.0, 20000),
    "09:40": (100, 100.5, 99.5, 100.0, 20000),
    "10:50": (100, 101.0, 99.9, 101.0, 90000),   # signal -> fill 10:55 = allowed
})
last_ok = ob.simulate_day(prep_warm(day), "TEST", cfg)
check("fill at 10:55 is allowed", len(last_ok) == 1 and
      last_ok[0]["entry_time"].time() == dtime(10, 55))

# (b) at most one long and one short attempt, never overlapping
bars = {"09:30": (100, 100.5, 99.5, 100.0, 20000),
        "09:35": (100, 100.5, 99.5, 100.0, 20000),
        "09:40": (100, 100.5, 99.5, 100.0, 20000)}
for clock in ["09:45", "09:55", "10:05", "10:15", "10:25", "10:35"]:
    bars[clock] = (100.6, 101.5, 99.0, 101.0, 90000)   # repeated long breakouts
day = make_day(bars=bars)
res = ob.simulate_day(prep_warm(day), "TEST", cfg)
check("at most one LONG attempt per day",
      sum(1 for t in res if t["direction"] == "long") <= 1, f"got {len(res)} longs")
entries = sorted((t["entry_time"], t["exit_time"]) for t in res)
check("no overlapping positions in the same ticker",
      all(entries[i][1] <= entries[i + 1][0] for i in range(len(entries) - 1)))

# (c) flat by the close, never overnight
day = make_day(bars={
    "09:30": (100, 100.5, 99.5, 100.0, 20000),
    "09:35": (100, 100.5, 99.5, 100.0, 20000),
    "09:40": (100, 100.5, 99.5, 100.0, 20000),
    "10:00": (100, 101.0, 99.9, 101.0, 90000),
})
res = ob.simulate_day(prep_warm(day), "TEST", cfg)   # flat bars after -> neither stop nor target
check("position is closed by the end of the session", len(res) == 1)
if res:
    check("time exit happens at 15:55, not 16:00",
          res[0]["exit_time"].time() == dtime(15, 55) and res[0]["exit_reason"] == "eod_time_exit",
          f"{res[0]['exit_time']} / {res[0]['exit_reason']}")


# --------------------------------------------------------------------------
print("\n8. Stop selection: tighter of 1 ATR and the opposite OR side")
# --------------------------------------------------------------------------
sig = pd.Series({"atr": 0.40, "vwap": 100.0, "volume": 1000.0, "avg_volume": 500.0})
ts = pd.Timestamp("2024-03-15 10:00", tz=MARKET_TZ)
# OR low far away (98.0) -> the 1 ATR stop is tighter
p = ob.open_position("T", "long", sig, ts, 101.0, ts, orh=100.5, orl=98.0, cfg=cfg)
check("long picks the ATR stop when the OR low is further away",
      p["stop_source"] == "atr" and abs(p["stop_price"] - (p["entry_price"] - 0.40)) < 1e-9)
# OR low very close (100.9) -> the OR side is tighter
p = ob.open_position("T", "long", sig, ts, 101.0, ts, orh=100.5, orl=100.9, cfg=cfg)
check("long picks the OR low when it is nearer than 1 ATR",
      p["stop_source"] == "or_low" and abs(p["stop_price"] - 100.9) < 1e-9)
p = ob.open_position("T", "short", sig, ts, 99.0, ts, orh=99.05, orl=99.5, cfg=cfg)
check("short picks the OR high when it is nearer than 1 ATR", p["stop_source"] == "or_high")
check("short stop is above entry", p["stop_price"] > p["entry_price"])
check("R multiple maths: target is exactly target_r x risk",
      abs((p["entry_price"] - p["target_price"]) - cfg.target_r * (p["stop_price"] - p["entry_price"])) < 1e-9)
# an unusable stop must produce no trade, not a broken one
bad = ob.open_position("T", "long", pd.Series({"atr": np.nan, "vwap": 100.0,
                                               "volume": 1.0, "avg_volume": 1.0}),
                       ts, 101.0, ts, orh=100.5, orl=98.0, cfg=cfg)
check("no trade when ATR is not yet available", bad is None)


# --------------------------------------------------------------------------
print("\n9. Filters actually gate entries")
# --------------------------------------------------------------------------
bar_below_vwap = pd.Series({"close": 101.0, "volume": 90000.0,
                            "vwap": 102.0, "avg_volume": 10000.0})
check("VWAP filter rejects a breakout below VWAP",
      ob.evaluate_signal(bar_below_vwap, 100.5, 99.0, ob.Config.build("B_orb_vwap", "1.5R")) is None)
check("without the VWAP filter the same bar is a long",
      ob.evaluate_signal(bar_below_vwap, 100.5, 99.0, ob.Config.build("A_orb_only", "1.5R")) == "long")
weak_volume = pd.Series({"close": 101.0, "volume": 5000.0, "vwap": 100.0, "avg_volume": 10000.0})
check("volume filter rejects a low-volume breakout",
      ob.evaluate_signal(weak_volume, 100.5, 99.0, ob.Config.build("C_orb_volume", "1.5R")) is None)


# --------------------------------------------------------------------------
print("\n10. Costs and P&L accounting")
# --------------------------------------------------------------------------
pos = {"direction": "long", "shares": 100, "raw_entry": 100.0, "entry_price": 100.01,
       "risk_per_share": 0.50}
t = ob.close_position(pos, raw_exit=101.0, exit_time=ts, reason="target", is_market=False)
check("gross P&L ignores costs", abs(t["gross_pnl"] - 100.0) < 1e-9, str(t["gross_pnl"]))
check("net P&L pays spread, slippage and both commissions",
      abs(t["net_pnl"] - ((101.0 - 100.01) * 100 - 2 * max(100 * ob.COMMISSION_PER_SHARE,
                                                           ob.MIN_COMMISSION_ORDER))) < 1e-9,
      str(t["net_pnl"]))
check("net P&L is strictly worse than gross", t["net_pnl"] < t["gross_pnl"])
check("R multiple is net P&L over dollars risked",
      abs(t["r_multiple"] - t["net_pnl"] / (0.50 * 100)) < 1e-9)


# --------------------------------------------------------------------------
print("\n11. Timezone / DST handling")
# --------------------------------------------------------------------------
# 2024-03-10 was the US DST switch; 09:30 local must still be 09:30 local.
utc_bars = pd.DataFrame({
    "open": [100.0] * 4, "high": [100.5] * 4, "low": [99.5] * 4,
    "close": [100.0] * 4, "volume": [1000.0] * 4,
}, index=pd.to_datetime(["2024-03-08 14:30", "2024-03-08 21:05",   # EST: UTC-5
                         "2024-03-11 13:30", "2024-03-11 20:05"],  # EDT: UTC-4
                        utc=True))
local = utc_bars.tz_convert(MARKET_TZ)
rth = ob.filter_regular_hours(local)
check("09:30 ET is kept on both sides of the DST switch",
      list(rth.index.time).count(dtime(9, 30)) == 2, str(list(rth.index.time)))
check("post-16:00 bars are dropped on both sides of the DST switch", len(rth) == 2)

sessions = pd.DatetimeIndex(pd.date_range("2024-01-01", periods=100, freq="B"))
ins, oos, boundary = ob.split_sessions(sessions, 0.70)
check("70/30 split is chronological and non-overlapping",
      len(ins) == 70 and len(oos) == 30 and ins[-1] < oos[0])
check("split boundary is the first out-of-sample session", boundary == oos[0])


# --------------------------------------------------------------------------
print("\n" + "=" * 70)
print(f"{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    for name in FAIL:
        print(f"  FAILED: {name}")
raise SystemExit(1 if FAIL else 0)
