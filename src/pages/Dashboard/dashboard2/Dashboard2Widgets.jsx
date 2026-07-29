import { useMemo, useState } from 'react';
import { Info, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';

const SECTION_TITLE_STYLE = { color: 'rgb(30, 47, 130)' };

const SERIES_LABELS = {
  advertiser: 'advertiser',
  publisher: 'publisher',
  ecpm: 'eCPM',
  netEcpm: 'Net eCPM',
  v: 'Value',
};

function formatKpiTooltipValue(cardId, key, value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const num = Number(value);

  if (cardId === 'gross-revenue') {
    return Math.round(num).toLocaleString('en-US');
  }
  if (cardId === 'ecpm') {
    return num.toFixed(2);
  }
  if (cardId === 'ctr' || cardId === 'fill-rate') {
    return `${num.toFixed(2)}%`;
  }
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function KpiChartTooltip({ active, payload, label, cardId }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="tabular-nums">
          {SERIES_LABELS[entry.dataKey] || entry.dataKey} : {formatKpiTooltipValue(cardId, entry.dataKey, entry.value)}
        </p>
      ))}
    </div>
  );
}

function ShareBar({ pct }) {
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="h-2 flex-1 max-w-[80px] rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#3b82c4]"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap">{pct.toFixed(2)}% of Total</span>
    </div>
  );
}

function ChangeBadge({ value }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium',
        positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      )}
    >
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

function InlineBar({ display, ratio }) {
  const width = Math.min(Math.max(ratio * 100, 0), 100);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className="text-sm tabular-nums text-right min-w-[72px]">{display}</span>
      <div className="h-2 flex-1 max-w-[100px] rounded-sm bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-[#7eb8e8] rounded-sm"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function FunnelProgress({ pct }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs tabular-nums text-slate-500 w-14 text-right">{pct.toFixed(2)}%</span>
      <div className="h-2 flex-1 max-w-[200px] rounded-sm bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-[#7c6fc4] rounded-sm"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function KpiCardGrid({ cards, chartDates = [], loading = false }) {
  if (!cards.length && !loading) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">No KPI data for the selected period.</p>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4', loading && 'opacity-70')}>
      {cards.map((card) => {
        const dates = chartDates.length ? chartDates : card.series[0]?.data.map((_, i) => `${i + 1}`);
        const data = dates.map((date, i) => {
          const row = { date };
          card.series.forEach((s) => {
            row[s.key] = s.data[i];
          });
          return row;
        });

        return (
          <Card key={card.id} className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className={TAILWIND_CLASSES.formSectionLabel}>{card.title}</p>
                    {card.subtitle && (
                      <span className="text-xs text-slate-500 text-right leading-snug max-w-[160px]">
                        {card.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="h-[100px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip content={<KpiChartTooltip cardId={card.id} />} />
                        {card.series.map((s) => (
                          <Bar
                            key={s.key}
                            dataKey={s.key}
                            fill={s.color}
                            radius={[2, 2, 0, 0]}
                            maxBarSize={card.chartType === 'dual' ? 14 : 28}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3 shrink-0 min-w-[130px] border-l border-slate-100 pl-4">
                  {card.stats.map((stat, idx) => (
                    <div key={idx}>
                      {stat.label && (
                        <p className={TAILWIND_CLASSES.formSectionLabel}>{stat.label}</p>
                      )}
                      <p
                        className={cn(
                          'text-lg lg:text-xl font-bold tabular-nums',
                          stat.color,
                          stat.valueClass
                        )}
                      >
                        {stat.value}
                      </p>
                      {stat.change !== undefined && (
                        <div className="mt-1">
                          <ChangeBadge value={stat.change} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function FunnelSection({ rows, loading = false }) {
  if (!rows.length && !loading) {
    return null;
  }

  return (
    <div className={cn('space-y-4', loading && 'opacity-70')}>
      <CardTitle className="flex items-center gap-2 text-base" style={SECTION_TITLE_STYLE}>
          Funnel Analysis
        </CardTitle>
      <FunnelCard title="Ad Request Flow" rows={rows} valueLabel="Ad Requests" />
    </div>
  );
}

function FunnelCard({ title, rows, valueLabel }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm" style={SECTION_TITLE_STYLE}>
          {title}
          <Info className="h-4 w-4 text-slate-400" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Stage</TableHead>
              <TableHead className="text-xs text-right">{valueLabel}</TableHead>
              <TableHead className="text-xs">Remaining {valueLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.stage}>
                <TableCell className="text-sm font-medium text-slate-900">{row.stage}</TableCell>
                <TableCell className="text-sm text-right tabular-nums">{row.value}</TableCell>
                <TableCell>
                  <FunnelProgress pct={row.pct} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function buildRankedTableColumns(nameLabel, valueType) {
  const isCurrency = valueType === 'currency';
  const valueSuffix = isCurrency ? ' $' : '';
  const formatValue = isCurrency
    ? (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (v) => v.toLocaleString('en-US');

  return [
    { key: 'name', label: nameLabel, primary: true },
    { key: 'yesterday', label: `Yest.${valueSuffix}`, align: 'right', format: formatValue },
    { key: 'avg7d', label: `Period Avg.${valueSuffix}`, align: 'right', format: formatValue },
    { key: 'change', label: 'Change', align: 'right' },
    { key: 'total', label: `Total${valueSuffix}`, align: 'right', format: formatValue },
    {
      key: 'pctTotal',
      label: '% of Total',
      align: 'right',
      format: (v) => `${v.toFixed(2)}%`,
    },
  ];
}

export function RankedTableCard({
  title,
  sharePct,
  columns,
  rows,
  viewByOptions,
  viewByData,
  viewByDefault = 'Gross Revenue',
  nameColumnLabel = 'Name',
  footerLink,
}) {
  const [viewBy, setViewBy] = useState(viewByDefault);

  const resolved = useMemo(() => {
    if (viewByData) {
      const data = viewByData[viewBy] ??
        viewByData[viewByDefault] ?? { rows: [], sharePct: 0, valueType: 'currency' };
      return {
        rows: data.rows,
        sharePct: data.sharePct,
        columns: buildRankedTableColumns(data.nameColumnLabel ?? nameColumnLabel, data.valueType),
      };
    }
    return {
      rows: rows ?? [],
      sharePct,
      columns: columns ?? [],
    };
  }, [viewByData, viewBy, viewByDefault, rows, sharePct, columns, nameColumnLabel]);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-sm" style={SECTION_TITLE_STYLE}>
              {title}
            </CardTitle>
            {resolved.sharePct != null && <ShareBar pct={resolved.sharePct} />}
          </div>
          {viewByOptions && (
            <div className="flex items-center gap-2">
              <Label variant="body" className="text-xs text-slate-500">
                View By
              </Label>
              <Select value={viewBy} onValueChange={setViewBy}>
                <SelectTrigger className="h-9 w-[160px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {viewByOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              {resolved.columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn('text-xs', col.align === 'right' && 'text-right')}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolved.rows.map((row, i) => (
              <TableRow key={i}>
                {resolved.columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      col.align === 'right' && 'text-right tabular-nums',
                      col.primary
                        ? 'font-semibold text-slate-900 max-w-[280px] truncate'
                        : 'text-sm'
                    )}
                  >
                    {col.key === 'change' ? (
                      <ChangeBadge value={row.change} />
                    ) : col.format ? (
                      col.format(row[col.key], row)
                    ) : (
                      row[col.key]
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {footerLink && (
          <div className="px-6 py-3 border-t border-slate-100 text-right">
            <button
              type="button"
              className={cn('text-sm font-medium hover:underline', TAILWIND_CLASSES.primaryText)}
            >
              {footerLink}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DistributionTables({ sections, loading = false }) {
  if (!sections.length) return null;
  const formatMoney = (v) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const formatNum = (v) => v.toLocaleString('en-US');
  const formatEcpm = (v) => `$${v.toFixed(2)}`;

  return (
    <div className={cn('space-y-4', loading && 'opacity-70')}>
      <CardTitle className="text-base" style={SECTION_TITLE_STYLE}>
        Ad Distribution
      </CardTitle>
      {sections.map(({ title, rows }) => {
        const maxGross = Math.max(...rows.map((r) => r.gross));
        return (
          <Card key={title} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm" style={SECTION_TITLE_STYLE}>
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[180px]">{title}</TableHead>
                    <TableHead className="text-xs">Price Advertiser</TableHead>
                    <TableHead className="text-xs">Price Publisher</TableHead>
                    <TableHead className="text-xs">Impressions</TableHead>
                    <TableHead className="text-xs">eCPM $</TableHead>
                    <TableHead className="text-xs">Net eCPM $</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-semibold text-slate-900">{row.label}</TableCell>
                      <TableCell>
                        <InlineBar display={formatMoney(row.gross)} ratio={row.gross / maxGross} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{formatMoney(row.net)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{formatNum(row.impressions)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{formatEcpm(row.ecpm)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{formatEcpm(row.netEcpm)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
