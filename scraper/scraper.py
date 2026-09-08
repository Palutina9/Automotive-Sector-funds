"""
Daily fund scraper — writes public/auto_data.json.

This is a TEMPLATE. Replace FUNDS with the real fund list and uncomment the
real fetch logic. The output format MUST match what the dashboard expects:
a flat list of single-key objects shaped as `{FundName}_{metric}`.

Expected output shape (see public/auto_data.json for a full example):

    [
      {"Khodran_fundSimpleReturn": 2.263},
      {"Khodran_fundSimpleReturn": 4.998},
      ... (8 values, positional — must match PERIOD_KEYS in dashboard-data.ts)
      {"Khodran_fundNAV": 10328943532074.0},
      {"Khodran_fundDailyReturn": 1.85},

      {"TakhtGaz_fundSimpleReturn": 2.076},
      ...
    ]

The 8 fundSimpleReturn values per fund must be in this exact order:
  1. SIMPLE_WEEKLY
  2. SIMPLE_MONTHLY
  3. SIMPLE_MONTHLY3
  4. SIMPLE_MONTHLY6
  5. SIMPLE_YEARLY
  6. SIMPLE_ALL_DAYS
  7. MAX_SIMPLE_WEEKLY
  8. MIN_SIMPLE_WEEKLY

Usage:
  python scraper.py                 # writes to public/auto_data.json
  OUTPUT_PATH=/tmp/test.json python scraper.py   # override output path
"""

import json
import os
from pathlib import Path
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Configuration — REPLACE THESE with your real fund list and API endpoints.
# ---------------------------------------------------------------------------

FUNDS: list[dict[str, str]] = [
    # Each fund must have:
    #   - slug: the prefix used in the JSON keys (e.g. "Khodran")
    #   - api:  the API URL that returns {"rows": [...]}
    {"slug": "Khodran",   "api": "https://example.com/api/fund/khodran"},
    {"slug": "TakhtGaz",  "api": "https://example.com/api/fund/takhtgaz"},
    {"slug": "Kiano",     "api": "https://example.com/api/fund/kiano"},
    {"slug": "Asemooni",  "api": "https://example.com/api/fund/asemooni"},
    {"slug": "Maadiran",  "api": "https://example.com/api/fund/maadiran"},
    {"slug": "Torange",   "api": "https://example.com/api/fund/torange"},
    # AutoAgah is geo-blocked → it stays in manual_data.json, NOT here.
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
}

OUTPUT_PATH = os.environ.get(
    "OUTPUT_PATH",
    str(Path(__file__).resolve().parent.parent / "public" / "auto_data.json"),
)


# ---------------------------------------------------------------------------
# Fetching.
# ---------------------------------------------------------------------------

def fetch_fund_data(fund: dict[str, str]) -> list[dict[str, Any]] | None:
    """
    Fetch one fund's data from its API and convert to the flat single-key
    object format the dashboard expects.

    Returns None if the fetch failed.
    """
    try:
        r = requests.get(fund["api"], headers=HEADERS, timeout=30)
        r.raise_for_status()
        payload = r.json()
    except Exception as e:
        print(f"✗ {fund['slug']}: fetch failed — {e}")
        return None

    rows = payload.get("rows") or []
    if not rows:
        print(f"✗ {fund['slug']}: no rows in response")
        return None

    slug = fund["slug"]
    out: list[dict[str, Any]] = []

    # 8 simple returns (positional — rows[0..7] map to PERIOD_KEYS in order).
    for row in rows[:8]:
        val = row.get("fundSimpleReturn")
        if val is None:
            val = 0.0
        out.append({f"{slug}_fundSimpleReturn": float(val)})

    # NAV
    nav = rows[0].get("fundNAV") if rows else None
    if nav is not None:
        out.append({f"{slug}_fundNAV": float(nav)})

    # Daily return
    daily = rows[0].get("fundDailyReturn") if rows else None
    if daily is not None:
        out.append({f"{slug}_fundDailyReturn": float(daily)})

    print(f"✓ {slug}: {len(out)} entries")
    return out


# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------

def main() -> int:
    print(f"=== Fund scraper starting ===")
    print(f"Output: {OUTPUT_PATH}")
    print(f"Funds:  {[f['slug'] for f in FUNDS]}")
    print()

    all_entries: list[dict[str, Any]] = []
    errors: list[str] = []

    for fund in FUNDS:
        result = fetch_fund_data(fund)
        if result is None:
            errors.append(fund["slug"])
            continue
        all_entries.extend(result)

    if not all_entries:
        print("\n✗ No data fetched — aborting (would overwrite with empty file).")
        return 1

    # Write to the output path.
    out_path = Path(OUTPUT_PATH)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Wrote {len(all_entries)} entries to {out_path}")
    if errors:
        print(f"⚠ {len(errors)} fund(s) failed: {errors}")
        # Exit 0 anyway — partial data is better than no data, and we want
        # the commit + deploy to happen. Adjust to `return 1` if you'd
        # rather fail the build on any error.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
