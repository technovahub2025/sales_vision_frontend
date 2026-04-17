export function ChartPanel({ title, subtitle = '', loading = false, hasData = true, emptyText = 'No data in selected range.', children, actions = null }) {
  return (
    <article className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-on-surface">{title}</h3>
          {subtitle ? <p className="text-xs text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {loading ? (
        <div className="h-64 animate-pulse rounded-md bg-surface-container-low" />
      ) : hasData ? (
        children
      ) : (
        <div className="flex h-64 items-center justify-center rounded-md bg-surface-container-low text-sm text-on-surface-variant">{emptyText}</div>
      )}
    </article>
  );
}

function defaultValueFormatter(value) {
  if (typeof value === 'number') {
    return value.toLocaleString('en-IN');
  }
  return value;
}

export function AnalyticsTooltip({ active, payload, label, formatter = defaultValueFormatter }) {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  return (
    <div className="rounded-md border border-outline-variant/25 bg-surface px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-on-surface">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((row) => (
          <div key={row.dataKey} className="flex items-center justify-between gap-3">
            <span className="text-on-surface-variant">{row.name || row.dataKey}</span>
            <span className="font-semibold text-on-surface">{formatter(row.value, row.name || row.dataKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
