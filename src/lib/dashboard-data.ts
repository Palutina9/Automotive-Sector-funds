// Client-side data normalization layer.
// Reads /auto_data.json + /manual_data.json (flat lists of single-key objects
// shaped as `${FundName}_${metric}`) and merges them into one structured
// response for the dashboard.

export interface PeriodDef {
  /** Original API key, e.g. "SIMPLE_WEEKLY". */
  key: string;
  /** Persian label, e.g. "بازدهی هفتگی". */
  labelFa: string;
  fromDate: string;
  toDate: string;
  /** Market benchmark simple return for this period (percent). */
  marketSimpleReturn: number | null;
}

export interface FundMetrics {
  /** Slug used in the JSON key prefix, e.g. "Khodran". */
  slug: string;
  /** Persian display name. */
  nameFa: string;
  /** 8 simple returns, positional (aligned with PERIOD_KEYS). */
  simpleReturns: (number | null)[];
  /** Daily return (percent). */
  dailyReturn: number | null;
  /** Net asset value (tomans). */
  nav: number | null;
  /** true if fund was scraped manually (geo-blocked). */
  manual: boolean;
}

export interface DashboardData {
  periods: PeriodDef[];
  funds: FundMetrics[];
  marketDailyReturn: number | null;
  fetchedAt: string;
  /** Total NAV across all funds (sum, tomans). */
  totalNav: number;
  /** Funds count. */
  fundsCount: number;
  /** True if the JSON files failed to load. */
  loadError: string | null;
}

// Canonical period order — must match the order in which the API returns
// the 8 fundSimpleReturn values per fund.
const PERIOD_KEYS = [
  "SIMPLE_WEEKLY",
  "SIMPLE_MONTHLY",
  "SIMPLE_MONTHLY3",
  "SIMPLE_MONTHLY6",
  "SIMPLE_YEARLY",
  "SIMPLE_ALL_DAYS",
  "MAX_SIMPLE_WEEKLY",
  "MIN_SIMPLE_WEEKLY",
] as const;

const PERIOD_LABELS_FA: Record<string, string> = {
  SIMPLE_WEEKLY: "بازدهی هفتگی",
  SIMPLE_MONTHLY: "بازدهی یک‌ماهه",
  SIMPLE_MONTHLY3: "بازدهی سه‌ماهه",
  SIMPLE_MONTHLY6: "بازدهی شش‌ماهه",
  SIMPLE_YEARLY: "بازدهی یک‌ساله",
  SIMPLE_ALL_DAYS: "بازدهی کل دوران",
  MAX_SIMPLE_WEEKLY: "بیشترین بازدهی هفتگی",
  MIN_SIMPLE_WEEKLY: "کمترین بازدهی هفتگی",
};

// Persian display names for funds. Slug = JSON key prefix (before `_`).
const FUND_NAMES_FA: Record<string, string> = {
  Khodran: "خودران",
  TakhtGaz: "تخت‌گاز",
  Kiano: "کیانو",
  Asemooni: "آسمانی",
  Maadiran: "مادیران",
  Torange: "Torange", // replace with Persian when known
  AutoAgah: "آوتوآگاه",
};

// Manual funds (geo-blocked, scraped manually and stored in manual_data.json).
const MANUAL_FUNDS = new Set(["AutoAgah"]);

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

type FlatRow = Record<string, number>;

/** Parse `${FundSlug}_${metric}` into parts. Returns null if not a fund row. */
function parseFundKey(k: string): { fundSlug: string; metric: string } | null {
  const idx = k.lastIndexOf("_");
  if (idx <= 0) return null;
  const fundSlug = k.slice(0, idx);
  const metric = k.slice(idx + 1);
  // Heuristic: metric must be one of the known metric suffixes.
  if (!["fundSimpleReturn", "fundDailyReturn", "fundNAV"].includes(metric)) {
    return null;
  }
  return { fundSlug, metric };
}

function toFaName(slug: string): string {
  return FUND_NAMES_FA[slug] ?? slug;
}

// ---------------------------------------------------------------------------
// Main loader.
// ---------------------------------------------------------------------------

export async function loadDashboardData(): Promise<DashboardData> {
  // Build paths that work both in dev (no basePath) and on GitHub Pages
  // (basePath = /<repo>).
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const autoUrl = `${base}/auto_data.json`;
  const manualUrl = `${base}/manual_data.json`;

  let autoRows: FlatRow[] = [];
  let manualRows: FlatRow[] = [];
  let loadError: string | null = null;

  try {
    const r = await fetch(autoUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    autoRows = (await r.json()) as FlatRow[];
  } catch (e) {
    loadError = `auto_data.json: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const r = await fetch(manualUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    manualRows = (await r.json()) as FlatRow[];
  } catch (e) {
    const msg = `manual_data.json: ${e instanceof Error ? e.message : String(e)}`;
    loadError = loadError ? `${loadError}; ${msg}` : msg;
  }

  // Parse periods out of manual_data (it's the only file that has the
  // period definitions: {key, fromDate, toDate, marketSimpleReturn}).
  const periods: PeriodDef[] = [];
  let marketDailyReturn: number | null = null;
  for (const row of manualRows) {
    if (typeof row.key === "string") {
      periods.push({
        key: row.key,
        labelFa: PERIOD_LABELS_FA[row.key] ?? row.key,
        fromDate: String(row.fromDate ?? ""),
        toDate: String(row.toDate ?? ""),
        marketSimpleReturn:
          typeof row.marketSimpleReturn === "number" ? row.marketSimpleReturn : null,
      });
    } else if (typeof row.marketDailyReturn === "number") {
      marketDailyReturn = row.marketDailyReturn;
    }
  }

  // Sort periods into canonical order (in case manual file is out of order).
  periods.sort(
    (a, b) =>
      PERIOD_KEYS.indexOf(a.key as (typeof PERIOD_KEYS)[number]) -
      PERIOD_KEYS.indexOf(b.key as (typeof PERIOD_KEYS)[number]),
  );

  // Collect fund rows from both files.
  // For each fund we expect: 8 fundSimpleReturn + 1 fundDailyReturn + 1 fundNAV.
  type FundAcc = {
    slug: string;
    simpleReturns: (number | null)[];
    dailyReturn: number | null;
    nav: number | null;
    manual: boolean;
  };
  const fundMap = new Map<string, FundAcc>();

  function ingest(rows: FlatRow[], isManual: boolean) {
    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        const parsed = parseFundKey(k);
        if (!parsed) continue;
        let acc = fundMap.get(parsed.fundSlug);
        if (!acc) {
          acc = {
            slug: parsed.fundSlug,
            simpleReturns: new Array(PERIOD_KEYS.length).fill(null),
            dailyReturn: null,
            nav: null,
            manual: isManual,
          };
          fundMap.set(parsed.fundSlug, acc);
        }
        if (parsed.metric === "fundSimpleReturn") {
          // Positional: append to the next empty slot.
          const idx = acc.simpleReturns.findIndex((x) => x === null);
          if (idx >= 0) acc.simpleReturns[idx] = typeof v === "number" ? v : null;
        } else if (parsed.metric === "fundDailyReturn") {
          acc.dailyReturn = typeof v === "number" ? v : null;
        } else if (parsed.metric === "fundNAV") {
          acc.nav = typeof v === "number" ? v : null;
        }
      }
    }
  }
  ingest(autoRows, false);
  ingest(manualRows, true);

  // Manual funds (in MANUAL_FUNDS set) take precedence for that slug.
  for (const acc of fundMap.values()) {
    if (MANUAL_FUNDS.has(acc.slug)) acc.manual = true;
  }

  const funds: FundMetrics[] = Array.from(fundMap.values()).map((acc) => ({
    slug: acc.slug,
    nameFa: toFaName(acc.slug),
    simpleReturns: acc.simpleReturns,
    dailyReturn: acc.dailyReturn,
    nav: acc.nav,
    manual: acc.manual,
  }));

  // Sort funds: auto funds first (alphabetical), then manual funds.
  funds.sort((a, b) => {
    if (a.manual !== b.manual) return a.manual ? 1 : -1;
    return a.slug.localeCompare(b.slug);
  });

  const totalNav = funds.reduce((s, f) => s + (f.nav ?? 0), 0);

  return {
    periods,
    funds,
    marketDailyReturn,
    fetchedAt: new Date().toISOString(),
    totalNav,
    fundsCount: funds.length,
    loadError,
  };
}
