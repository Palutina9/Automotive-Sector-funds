"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Calendar,
  Clock,
  Database,
  Download,
  Info,
  Layers,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  loadDashboardData,
  type DashboardData,
} from "@/lib/dashboard-data";

// ---------------------------------------------------------------------------
// Number / date formatting helpers (Persian locale).
// ---------------------------------------------------------------------------

function formatPercent(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  // Show 2 decimals, trailing % sign. Use Persian digits for visual consistency.
  const s = n.toLocaleString("fa-IR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${s}٪`;
}

function formatToman(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  // Plain number with thousands separators — no abbreviation.
  return n.toLocaleString("fa-IR");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "هرگز";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "لحظاتی پیش";
  if (sec < 3600) return `${Math.floor(sec / 60)} دقیقه پیش`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ساعت پیش`;
  return `${Math.floor(sec / 86400)} روز پیش`;
}

// Convert ASCII digits in a string to Persian digits.
function toFaDigits(s: string): string {
  return s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

// ---------------------------------------------------------------------------
// Color coding for returns.
// ---------------------------------------------------------------------------

function returnColorClass(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return "text-slate-500";
  return n > 0 ? "text-emerald-600" : "text-red-600";
}

function returnBgClass(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return "bg-slate-50";
  return n > 0 ? "bg-emerald-50" : "bg-red-50";
}

// ---------------------------------------------------------------------------
// Main page.
// ---------------------------------------------------------------------------

export default function Home() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  // Chart state — which period to compare.
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("4"); // 4 = yearly

  const PERIOD_OPTIONS = [
    { value: "0", label: "بازدهی هفتگی" },
    { value: "1", label: "بازدهی یک‌ماهه" },
    { value: "2", label: "بازدهی سه‌ماهه" },
    { value: "3", label: "بازدهی شش‌ماهه" },
    { value: "4", label: "بازدهی یک‌ساله" },
    { value: "5", label: "بازدهی کل دوران" },
    { value: "6", label: "بیشترین بازدهی هفتگی" },
    { value: "7", label: "کمترین بازدهی هفتگی" },
    { value: "daily", label: "بازدهی روزانه" },
  ];

  const chartData = React.useMemo(() => {
    if (!data) return [];
    return data.funds.map((f) => {
      let ret: number | null = null;
      if (selectedPeriod === "daily") {
        ret = f.dailyReturn;
      } else {
        const idx = parseInt(selectedPeriod, 10);
        if (!isNaN(idx) && idx >= 0 && idx < f.simpleReturns.length) {
          ret = f.simpleReturns[idx];
        }
      }
      return {
        name: f.nameFa,
        nav: f.nav ?? 0,
        return: ret,
      };
    });
  }, [data, selectedPeriod]);

  const selectedPeriodLabel =
    PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label ?? "";
  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const d = await loadDashboardData();
      setData(d);
      if (d.loadError && !silent) {
        toast({
          title: "خطا در بارگذاری داده‌ها",
          description: d.loadError,
          variant: "destructive",
        });
      }
    } catch (e) {
      if (!silent) {
        toast({
          title: "خطا",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    // Auto-refresh every 5 minutes so daily updates appear without reload.
    const t = setInterval(() => refresh(true), 5 * 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const exportExcel = React.useCallback(() => {
    if (!data) return;
    // Build pivot rows: period | fromDate | toDate | market | fund1 | fund2 | ...
    const headers = [
      "دوره",
      "از تاریخ",
      "تا تاریخ",
      "بازار",
      ...data.funds.map((f) => f.nameFa),
    ];
    const rows: (string | number)[][] = data.periods.map((p, i) => [
      p.labelFa,
      p.fromDate,
      p.toDate,
      p.marketSimpleReturn ?? "",
      ...data.funds.map((f) => f.simpleReturns[i] ?? ""),
    ]);
    // Add daily return row.
    rows.push([
      "بازدهی روزانه",
      "—",
      "—",
      data.marketDailyReturn ?? "",
      ...data.funds.map((f) => f.dailyReturn ?? ""),
    ]);
    // Add NAV row.
    rows.push([
      "NAV (تومان)",
      "—",
      "—",
      "—",
      ...data.funds.map((f) => f.nav ?? ""),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Make the first column wider.
    ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    for (let i = 0; i < data.funds.length; i++) ws["!cols"]?.push({ wch: 14 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "بازدهی صندوق‌ها");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `fund-returns-${stamp}.xlsx`);
    toast({ title: "فایل اکسل دانلود شد", description: `fund-returns-${stamp}.xlsx` });
  }, [data]);

  // --- Derived display state. ---
  const totalFunds = data?.fundsCount ?? 0;
  const totalNav = data?.totalNav ?? 0;
  const avgDailyReturn = React.useMemo(() => {
    if (!data) return null;
    const vals = data.funds
      .map((f) => f.dailyReturn)
      .filter((v): v is number => v != null && isFinite(v));
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [data]);

  const bestPerformer = React.useMemo(() => {
    if (!data || data.funds.length === 0) return null;
    // Use yearly return (index 4) as the "performer" metric.
    let best: { name: string; value: number } | null = null;
    for (const f of data.funds) {
      const v = f.simpleReturns[4];
      if (v != null && isFinite(v) && (best === null || v > best.value)) {
        best = { name: f.nameFa, value: v };
      }
    }
    return best;
  }, [data]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: "#2563eb" }}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                داشبورد بازدهی صندوق‌ها
              </h1>
              <p className="text-xs text-slate-500 leading-tight">
                مقایسه بازدهی صندوق‌های سرمایه‌گذاری — به‌روزرسانی روزانه
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-slate-200 text-slate-600 gap-1.5"
            >
              <Clock className="w-3 h-3" />
              {loading
                ? "در حال بارگذاری…"
                : `به‌روزرسانی: ${relativeTime(data?.fetchedAt ?? null)}`}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              disabled={refreshing}
            >
              <RefreshCw className={cn("w-4 h-4 ml-1.5", refreshing && "animate-spin")} />
              به‌روزرسانی
            </Button>
            <Button
              size="sm"
              onClick={exportExcel}
              disabled={!data}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 ml-1.5" />
              خروجی اکسل
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Error banner */}
        {data?.loadError && !loading && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">برخی فایل‌ها بارگذاری نشدند</p>
                <p className="text-amber-700 mt-1 font-mono text-xs">{data.loadError}</p>
                <p className="text-amber-700 mt-2 text-xs">
                  مطمئن شوید که فایل‌های <code>auto_data.json</code> و <code>manual_data.json</code> در پوشه <code>public/</code> قرار دارند.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={Building2}
            label="تعداد صندوق‌ها"
            value={loading ? null : toFaDigits(String(totalFunds))}
            accent="#2563eb"
          />
          <KpiCard
            icon={Database}
            label="مجموع دارایی (NAV)"
            value={loading ? null : formatToman(totalNav)}
            subValue="مجموع خالص ارزش دارایی‌ها"
            accent="#16a34a"
          />
          <KpiCard
            icon={Activity}
            label="میانگین بازدهی روزانه"
            value={loading ? null : formatPercent(avgDailyReturn)}
            subValue={loading ? null : "میانگین همه صندوق‌ها"}
            accent={avgDailyReturn != null && avgDailyReturn < 0 ? "#dc2626" : "#16a34a"}
          />
          <KpiCard
            icon={TrendingUp}
            label="بهترین بازدهی یک‌ساله"
            value={loading ? null : (bestPerformer ? formatPercent(bestPerformer.value) : "—")}
            subValue={loading ? null : (bestPerformer ? bestPerformer.name : "—")}
            accent="#9333ea"
          />
        </section>
        {/* Comparison chart */}
        <Card className="shadow-sm border-amber-200 bg-gradient-to-b from-amber-50/40 to-white">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  مقایسه صندوق‌ها
                </CardTitle>
                <CardDescription className="mt-1">
                  میله‌ها: NAV (میلیارد تومان) — خط: بازدهی دوره انتخاب‌شده (٪)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 font-medium">دوره:</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-slate-400">
                داده‌ای برای نمایش وجود ندارد
              </div>
            ) : (
              <div className="h-[400px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#78350f" }}
                      angle={-25}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      yAxisId="nav"
                      orientation="left"
                      tick={{ fontSize: 11, fill: "#92400e" }}
                      tickFormatter={(v) =>
                        `${(v / 1e9).toLocaleString("fa-IR", { maximumFractionDigits: 0 })}`
                      }
                    />
                    <YAxis
                      yAxisId="return"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#7c2d12" }}
                      tickFormatter={(v) =>
                        `${v.toLocaleString("fa-IR", { maximumFractionDigits: 0 })}٪`
                      }
                    />
                    <Tooltip content={<CustomTooltip periodLabel={selectedPeriodLabel} />} />
                    <Bar yAxisId="nav" dataKey="nav" name="NAV" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill="#f59e0b" />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="return"
                      type="monotone"
                      dataKey="return"
                      name={selectedPeriodLabel}
                      stroke="#dc2626"
                      strokeWidth={2.5}
                      dot={<CustomDot />}
                      activeDot={{ r: 7, fill: "#dc2626" }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pivot table */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="w-4 h-4 text-blue-600" />
              جدول مقایسه بازدهی صندوق‌ها
            </CardTitle>
            <CardDescription>
              بازدهی ساده به درصد — دوره‌های زمانی مختلف در سطرها، هر صندوق در یک ستون
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-800">
                    <th className="px-4 py-3 text-center font-bold whitespace-nowrap border-l border-slate-200">
                      دوره
                    </th>
                    <th className="px-3 py-3 text-center font-bold whitespace-nowrap border-l border-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        بازه زمانی
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center font-bold whitespace-nowrap border-l border-slate-200 bg-blue-50/50">
                      بازار
                      <div className="text-[10px] font-normal text-slate-400 mt-0.5">شاخص کل</div>
                    </th>
                    {data?.funds.map((f) => (
                      <th
                        key={f.slug}
                        className="px-3 py-3 text-center font-bold whitespace-nowrap border-l border-slate-200 last:border-l-0 text-slate-900"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {f.manual && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50"
                            >
                              دستی
                            </Badge>
                          )}
                          <span>{f.nameFa}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 9 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td colSpan={3 + (data?.funds.length ?? 6)} className="px-4 py-3">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {/* Daily return row — at the top */}
                      <tr className="border-b-2 border-blue-200 bg-blue-50/40 font-bold">
                        <td className="px-4 py-3 text-slate-900 whitespace-nowrap border-l border-slate-200">
                          بازدهی روزانه
                          <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                            {new Date().toLocaleDateString("fa-IR")}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap border-l border-slate-200 font-mono">
                          {new Date().toLocaleDateString("fa-IR")}
                        </td>
                        <td className={cn(
                          "px-3 py-3 text-center font-mono text-sm whitespace-nowrap border-l border-slate-200 bg-blue-50/60",
                          returnColorClass(data?.marketDailyReturn),
                        )}>
                          <div className="flex items-center justify-center gap-1">
                            {data?.marketDailyReturn != null && data.marketDailyReturn !== 0 && (
                              data.marketDailyReturn > 0
                                ? <ArrowUp className="w-3.5 h-3.5" />
                                : <ArrowDown className="w-3.5 h-3.5" />
                            )}
                            {formatPercent(data?.marketDailyReturn)}
                          </div>
                        </td>
                        {data?.funds.map((f) => (
                          <td
                            key={f.slug}
                            className={cn(
                              "px-3 py-3 text-center font-mono text-sm whitespace-nowrap border-l border-slate-200 last:border-l-0",
                              returnBgClass(f.dailyReturn),
                              returnColorClass(f.dailyReturn),
                            )}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {f.dailyReturn != null && f.dailyReturn !== 0 && (
                                f.dailyReturn > 0
                                  ? <ArrowUp className="w-3.5 h-3.5" />
                                  : <ArrowDown className="w-3.5 h-3.5" />
                              )}
                              {formatPercent(f.dailyReturn)}
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Period rows */}
                      {data?.periods.map((p, i) => (
                        <tr
                          key={p.key}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition"
                        >
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap border-l border-slate-200 text-center">
                            {p.labelFa}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap border-l border-slate-200 font-mono text-center">
                            <div>{toFaDigits(p.fromDate)}</div>
                            <div className="text-slate-400">تا {toFaDigits(p.toDate)}</div>
                          </td>
                          <td className={cn(
                            "px-3 py-3 text-center font-mono text-sm whitespace-nowrap border-l border-slate-200 bg-blue-50/30 font-bold",
                            returnColorClass(p.marketSimpleReturn),
                          )}>
                            <div className="flex items-center justify-center gap-1">
                              {p.marketSimpleReturn != null && p.marketSimpleReturn !== 0 && (
                                p.marketSimpleReturn > 0
                                  ? <ArrowUp className="w-3.5 h-3.5" />
                                  : <ArrowDown className="w-3.5 h-3.5" />
                              )}
                              {formatPercent(p.marketSimpleReturn)}
                            </div>
                          </td>
                          {data.funds.map((f) => {
                            const v = f.simpleReturns[i];
                            return (
                              <td
                                key={f.slug}
                                className={cn(
                                  "px-3 py-3 text-center font-mono text-sm whitespace-nowrap border-l border-slate-200 last:border-l-0 font-bold",
                                  returnBgClass(v),
                                  returnColorClass(v),
                                )}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  {v != null && v !== 0 && (
                                    v > 0
                                      ? <ArrowUp className="w-3.5 h-3.5" />
                                      : <ArrowDown className="w-3.5 h-3.5" />
                                  )}
                                  {formatPercent(v)}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* NAV row */}
                      <tr className="bg-slate-100/60 font-bold">
                        <td className="px-4 py-3 text-slate-900 whitespace-nowrap border-l border-slate-200 text-center">
                          خالص ارزش دارایی (NAV)
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap border-l border-slate-200 text-center">
                          —
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs whitespace-nowrap border-l border-slate-200 text-slate-400">
                          —
                        </td>
                        {data?.funds.map((f) => (
                          <td
                            key={f.slug}
                            className="px-3 py-3 text-center font-mono text-xs whitespace-nowrap border-l border-slate-200 last:border-l-0 text-slate-900"
                          >
                            {formatToman(f.nav)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Info / help */}
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <p>
                <strong className="text-slate-800">نحوه کار:</strong> فایل <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">auto_data.json</code> به‌صورت خودکار توسط GitHub Actions هر روز ساعت ۱۲:۳۰ به‌وقت تهران به‌روزرسانی می‌شود.
              </p>
              <p>
                فایل <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">manual_data.json</code> شامل صندوق‌های دارای محدودیت شبکه است و به‌صورت دستی بارگذاری می‌شود.
              </p>
              <p>
                صندوق‌های دارای برچسب <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50 mx-1">دستی</Badge> به‌صورت دستی جمع‌آوری شده‌اند.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-slate-200 mt-auto bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            میزبانی روی GitHub Pages — داده‌ها روزانه به‌روزرسانی می‌شوند
          </span>
          <span>
            {data && `آخرین بارگذاری: ${formatDateTime(data.fetchedAt)}`}
          </span>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart helpers.
// ---------------------------------------------------------------------------

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const v = payload?.return;
  // Warm palette: orange for positive, dark red for negative, amber for zero/null.
  const fill =
    v != null && v > 0
      ? "#ea580c"
      : v != null && v < 0
      ? "#b91c1c"
      : "#92400e";
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="white" strokeWidth={1.5} />;
}

function CustomTooltip({
  active,
  payload,
  label,
  periodLabel,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null }>;
  label?: string;
  periodLabel?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const navEntry = payload.find((p) => p.dataKey === "nav");
  const retEntry = payload.find((p) => p.dataKey === "return");
  const nav = navEntry?.value;
  const ret = retEntry?.value;

  return (
    <div
      className="bg-white border border-amber-200 rounded-lg shadow-lg p-3 text-xs space-y-1.5"
      dir="rtl"
    >
      <p className="font-bold text-slate-900 text-sm border-b border-amber-100 pb-1.5 mb-1">
        {label}
      </p>
      {nav != null && (
        <div className="flex items-center justify-between gap-6">
          <span className="text-amber-700">NAV (تومان):</span>
          <span className="font-mono font-bold text-slate-900">
            {nav.toLocaleString("fa-IR")}
          </span>
        </div>
      )}
      {ret != null && (
        <div className="flex items-center justify-between gap-6">
          <span className="text-red-700">{periodLabel || "بازدهی"}:</span>
          <span
            className={cn(
              "font-mono font-bold",
              ret > 0
                ? "text-emerald-600"
                : ret < 0
                ? "text-red-600"
                : "text-slate-500"
            )}
          >
            {ret > 0 ? "+" : ""}
            {ret.toLocaleString("fa-IR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            ٪
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small subcomponents.
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  subValue,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | null;
  subValue?: string | null;
  accent: string;
}) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">{label}</p>
            {value === null ? (
              <Skeleton className="h-7 w-24 mt-1.5" />
            ) : (
              <p className="text-xl font-bold mt-1 truncate" title={String(value)}>
                {value}
              </p>
            )}
            {subValue ? (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={subValue}>
                {subValue}
              </p>
            ) : null}
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: accent + "15", color: accent }}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
