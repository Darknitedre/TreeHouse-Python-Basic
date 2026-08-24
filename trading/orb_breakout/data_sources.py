"""Modular market-data layer for the Opening Range Breakout backtester.

The backtest engine only ever calls :func:`load_bars`.  Every provider below
returns the *same* contract, so swapping vendors never touches strategy code:

    DataFrame indexed by a tz-aware DatetimeIndex in America/New_York,
    sorted ascending, no duplicate timestamps, with float columns
    ``open, high, low, close, volume``.

Bar-labelling convention
------------------------
Every provider here labels a bar by its **start** time (Yahoo, Alpaca,
Polygon, Databento and IBKR all do this).  So the bar stamped ``09:30``
covers 09:30:00-09:34:59.  The strategy code depends on this; if you add a
provider that stamps bars by their *close*, shift it back one interval
inside your loader, not in the strategy.

Provider notes
--------------
yahoo      Free, no key.  Only ~60 calendar days of 5-minute history -- fine
           for a smoke test, useless for a 2-5 year study.
alpaca     Free tier (IEX feed) or paid (SIP, full consolidated tape, history
           back to 2016).  ``pip install alpaca-py``.
polygon    Paid intraday plans give many years of 5-minute aggregates.
databento  Institutional; 1-minute OHLCV resampled to 5-minute here.
ibkr       Interactive Brokers via ib_insync; needs a running TWS/Gateway.
csv        Local files you already downloaded (the escape hatch that always
           works, and what the on-disk cache uses).
synthetic  Deterministic fake bars.  ONLY for exercising the code path when
           you have no data access.  Never report these as results.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

MARKET_TZ = "America/New_York"
OHLCV = ["open", "high", "low", "close", "volume"]


# --------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------
def _normalise(df: pd.DataFrame, source: str) -> pd.DataFrame:
    """Coerce any provider's frame into the common contract."""
    if df is None or len(df) == 0:
        return pd.DataFrame(columns=OHLCV)

    df = df.copy()
    df.columns = [str(c).lower() for c in df.columns]
    missing = [c for c in OHLCV if c not in df.columns]
    if missing:
        raise ValueError(f"{source}: missing column(s) {missing}; got {list(df.columns)}")
    df = df[OHLCV].astype(float)

    idx = pd.DatetimeIndex(df.index)
    # Naive timestamps from a vendor are assumed to already be UTC unless the
    # loader localised them itself -- every loader below localises explicitly.
    idx = idx.tz_localize("UTC") if idx.tz is None else idx
    df.index = idx.tz_convert(MARKET_TZ)
    df.index.name = "timestamp"

    df = df[~df.index.duplicated(keep="first")].sort_index()
    # Drop rows a vendor pads with zero/NaN volume-less prints.
    df = df.dropna(subset=OHLCV)
    df = df[(df[["open", "high", "low", "close"]] > 0).all(axis=1)]
    return df


def _as_ts(value) -> pd.Timestamp:
    """Parse a date-ish input into a tz-aware market-time Timestamp."""
    ts = pd.Timestamp(value)
    return ts.tz_localize(MARKET_TZ) if ts.tz is None else ts.tz_convert(MARKET_TZ)


# --------------------------------------------------------------------------
# Providers
# --------------------------------------------------------------------------
def load_yahoo(symbol: str, start, end, minutes: int = 5) -> pd.DataFrame:
    """Yahoo Finance via yfinance.

    Yahoo caps intraday history at roughly 60 calendar days, so the request is
    clamped and a warning is printed rather than silently returning a short
    series that you might mistake for years of data.
    """
    import yfinance as yf

    start, end = _as_ts(start), _as_ts(end)
    earliest = pd.Timestamp.now(tz=MARKET_TZ).normalize() - timedelta(days=59)
    if start < earliest:
        print(
            f"  [yahoo] WARNING: {symbol} requested from {start.date()} but Yahoo only "
            f"serves ~60 days of {minutes}m bars. Clamping to {earliest.date()}. "
            f"Use --provider alpaca/polygon/databento/ibkr for multi-year history."
        )
        start = earliest

    raw = yf.download(
        symbol,
        start=start.tz_convert("UTC").tz_localize(None),
        end=end.tz_convert("UTC").tz_localize(None),
        interval=f"{minutes}m",
        prepost=False,       # regular hours only; we filter again downstream
        auto_adjust=False,   # never adjust intraday bars -- it distorts levels
        progress=False,
        threads=False,
    )
    if isinstance(raw.columns, pd.MultiIndex):  # yfinance >= 0.2.51 shape
        raw.columns = raw.columns.droplevel(-1) if symbol in raw.columns.get_level_values(-1) \
            else raw.columns.droplevel(0)
    return _normalise(raw, "yahoo")


def load_alpaca(symbol: str, start, end, minutes: int = 5) -> pd.DataFrame:
    """Alpaca Market Data v2 (recommended free/cheap multi-year source).

    Env vars: ALPACA_API_KEY, ALPACA_SECRET_KEY, optional ALPACA_FEED
    ('iex' on the free tier, 'sip' on a paid plan -- use 'sip' for research,
    IEX prints only a few percent of the tape and its volume filter will lie).
    """
    from alpaca.data.historical import StockHistoricalDataClient
    from alpaca.data.requests import StockBarsRequest
    from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
    from alpaca.data.enums import Adjustment, DataFeed

    key, secret = os.getenv("ALPACA_API_KEY"), os.getenv("ALPACA_SECRET_KEY")
    if not key or not secret:
        raise RuntimeError("Set ALPACA_API_KEY and ALPACA_SECRET_KEY in your environment.")
    feed = DataFeed(os.getenv("ALPACA_FEED", "iex").lower())

    client = StockHistoricalDataClient(key, secret)
    req = StockBarsRequest(
        symbol_or_symbols=[symbol],
        timeframe=TimeFrame(minutes, TimeFrameUnit.Minute),
        start=_as_ts(start).tz_convert("UTC").to_pydatetime(),
        end=_as_ts(end).tz_convert("UTC").to_pydatetime(),
        adjustment=Adjustment.ALL,   # splits/dividends applied consistently
        feed=feed,
    )
    df = client.get_stock_bars(req).df           # MultiIndex (symbol, timestamp)
    if len(df) == 0:
        return _normalise(df, "alpaca")
    df = df.reset_index().set_index("timestamp")
    df = df[df["symbol"] == symbol] if "symbol" in df.columns else df
    return _normalise(df, "alpaca")


def load_polygon(symbol: str, start, end, minutes: int = 5) -> pd.DataFrame:
    """Polygon.io aggregates, following ``next_url`` pagination to the end."""
    import requests

    key = os.getenv("POLYGON_API_KEY")
    if not key:
        raise RuntimeError("Set POLYGON_API_KEY in your environment.")

    s, e = _as_ts(start).date(), _as_ts(end).date()
    url = (
        f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/{minutes}/minute/{s}/{e}"
        f"?adjusted=true&sort=asc&limit=50000"
    )
    rows, session = [], requests.Session()
    while url:
        resp = session.get(url, params={"apiKey": key}, timeout=60)
        resp.raise_for_status()
        payload = resp.json()
        rows.extend(payload.get("results") or [])
        url = payload.get("next_url")
        if url:
            time.sleep(0.2)  # be polite to the rate limiter

    if not rows:
        return _normalise(None, "polygon")
    df = pd.DataFrame(rows).rename(
        columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"}
    )
    # 't' is epoch milliseconds, UTC.
    df.index = pd.to_datetime(df["t"], unit="ms", utc=True)
    return _normalise(df, "polygon")


def load_databento(symbol: str, start, end, minutes: int = 5) -> pd.DataFrame:
    """Databento 1-minute OHLCV, resampled up to the requested interval.

    Databento publishes ohlcv-1s/1m/1h/1d, so there is no native 5-minute
    schema -- pulling 1m and resampling is the correct approach and also lets
    you re-cut the same download at other intervals later.
    """
    import databento as db

    key = os.getenv("DATABENTO_API_KEY")
    if not key:
        raise RuntimeError("Set DATABENTO_API_KEY in your environment.")
    dataset = os.getenv("DATABENTO_DATASET", "EQUS.MINI")

    data = db.Historical(key).timeseries.get_range(
        dataset=dataset,
        symbols=[symbol],
        schema="ohlcv-1m",
        stype_in="raw_symbol",
        start=_as_ts(start).tz_convert("UTC").to_pydatetime(),
        end=_as_ts(end).tz_convert("UTC").to_pydatetime(),
    )
    df = data.to_df()
    if len(df) == 0:
        return _normalise(df, "databento")
    one_min = _normalise(df, "databento")
    return resample_bars(one_min, minutes)


def load_ibkr(symbol: str, start, end, minutes: int = 5) -> pd.DataFrame:
    """Interactive Brokers via ib_insync (needs TWS or IB Gateway running).

    IB rate-limits historical requests hard, so the range is pulled in 20
    trading-day chunks with a pause between calls.
    """
    from ib_insync import IB, Stock, util

    ib = IB()
    ib.connect(
        os.getenv("IB_HOST", "127.0.0.1"),
        int(os.getenv("IB_PORT", "7497")),
        clientId=int(os.getenv("IB_CLIENT_ID", "17")),
    )
    try:
        contract = Stock(symbol, "SMART", "USD")
        ib.qualifyContracts(contract)

        frames, cursor, start_ts = [], _as_ts(end), _as_ts(start)
        while cursor > start_ts:
            bars = ib.reqHistoricalData(
                contract,
                endDateTime=cursor.tz_convert("UTC").to_pydatetime(),
                durationStr="20 D",
                barSizeSetting=f"{minutes} mins",
                whatToShow="TRADES",
                useRTH=True,          # regular session only
                formatDate=2,         # epoch seconds, UTC -- avoids tz ambiguity
            )
            if not bars:
                break
            chunk = util.df(bars).set_index("date")
            frames.append(chunk)
            oldest = pd.Timestamp(chunk.index.min())
            oldest = oldest.tz_localize("UTC") if oldest.tz is None else oldest
            if oldest >= cursor:      # no progress -> stop rather than spin
                break
            cursor = oldest.tz_convert(MARKET_TZ)
            time.sleep(10)            # IB pacing rule
        if not frames:
            return _normalise(None, "ibkr")
        return _normalise(pd.concat(frames), "ibkr")
    finally:
        ib.disconnect()


def load_csv(symbol: str, start, end, minutes: int = 5, data_dir: str = "data") -> pd.DataFrame:
    """Local CSV: ``data/<SYMBOL>_<minutes>m.csv`` with a timestamp column.

    Timestamps may be tz-aware ISO strings (preferred) or naive UTC.
    """
    path = os.path.join(data_dir, f"{symbol}_{minutes}m.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No local file at {path}")
    df = pd.read_csv(path)
    tcol = next((c for c in df.columns if c.lower() in
                 ("timestamp", "datetime", "date", "time", "t")), df.columns[0])
    df.index = pd.to_datetime(df[tcol], utc=True, format="mixed")
    out = _normalise(df, "csv")
    return out.loc[(out.index >= _as_ts(start)) & (out.index <= _as_ts(end))]


def load_synthetic(symbol: str, start, end, minutes: int = 5) -> pd.DataFrame:
    """Deterministic random-walk bars for exercising the engine offline.

    NOT market data.  Any statistic produced from this is a code test, not a
    research result, and the backtester labels it as such.
    """
    rng = np.random.default_rng(abs(hash(symbol)) % (2**32))
    sessions = pd.bdate_range(_as_ts(start).date(), _as_ts(end).date(), tz=MARKET_TZ)
    per_day = int((6.5 * 60) // minutes)
    price = {"SPY": 450.0, "QQQ": 380.0, "IWM": 190.0}.get(symbol, 100.0)

    rows = []
    for day in sessions:
        open_time = day.normalize() + pd.Timedelta(hours=9, minutes=30)
        stamps = pd.date_range(open_time, periods=per_day, freq=f"{minutes}min")
        # Martingale: subtract sigma^2/2 so exp() carries NO drift. A drifting
        # test series would hand the engine a fake edge and mask real bias.
        price *= float(np.exp(rng.normal(-0.008 ** 2 / 2, 0.008)))   # overnight gap
        # U-shaped intraday volatility and volume, as in the real session.
        shape = np.linspace(-1, 1, per_day) ** 2 * 1.6 + 0.5
        for k, ts in enumerate(stamps):
            sigma = 0.0009 * shape[k]
            o = price
            steps = o * np.exp(np.cumsum(rng.normal(-sigma ** 2 / 2, sigma, 6)))
            c = float(steps[-1])
            rows.append(
                {
                    "timestamp": ts,
                    "open": o,
                    "high": float(max(steps.max(), o, c)),
                    "low": float(min(steps.min(), o, c)),
                    "close": c,
                    "volume": float(rng.integers(20_000, 90_000) * shape[k]),
                }
            )
            price = c
    return _normalise(pd.DataFrame(rows).set_index("timestamp"), "synthetic")


PROVIDERS = {
    "yahoo": load_yahoo,
    "alpaca": load_alpaca,
    "polygon": load_polygon,
    "databento": load_databento,
    "ibkr": load_ibkr,
    "csv": load_csv,
    "synthetic": load_synthetic,
}


# --------------------------------------------------------------------------
# Resampling + caching + public entry point
# --------------------------------------------------------------------------
def resample_bars(df: pd.DataFrame, minutes: int) -> pd.DataFrame:
    """Aggregate finer bars up to ``minutes``, anchored on the clock.

    ``label='left'`` keeps the start-stamped convention used everywhere else.
    """
    if df.empty:
        return df
    out = df.resample(f"{minutes}min", label="left", closed="left").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    )
    return out.dropna(subset=["open", "high", "low", "close"])


def _cache_path(cache_dir, provider, symbol, minutes, start, end) -> str:
    name = f"{provider}_{symbol}_{minutes}m_{_as_ts(start).date()}_{_as_ts(end).date()}.csv.gz"
    return os.path.join(cache_dir, name)


def load_bars(
    symbol: str,
    start,
    end,
    provider: str = "yahoo",
    minutes: int = 5,
    cache_dir: str = "data/cache",
    use_cache: bool = True,
) -> pd.DataFrame:
    """Single entry point the strategy uses.  Swap ``provider``, change nothing else."""
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'. Choose from {sorted(PROVIDERS)}")

    path = _cache_path(cache_dir, provider, symbol, minutes, start, end)
    if use_cache and os.path.exists(path):
        cached = pd.read_csv(path, index_col=0)
        cached.index = pd.to_datetime(cached.index, utc=True, format="mixed")
        print(f"  [cache] {symbol}: {len(cached):,} bars from {os.path.basename(path)}")
        return _normalise(cached, "cache")

    print(f"  [{provider}] downloading {symbol} {minutes}m bars ...")
    df = PROVIDERS[provider](symbol, start, end, minutes)

    if use_cache and not df.empty:
        os.makedirs(cache_dir, exist_ok=True)
        df.to_csv(path)
    return df
