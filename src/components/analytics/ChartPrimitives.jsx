export function ChartPanel({ title, subtitle = '', loading = false, hasData = true, emptyText = 'No data in selected range.', children, actions = null }) {
  return (
    <article className="sv-card sv-analytics-chart-panel rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      <div className="sv-analytics-chart-head mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="sv-analytics-chart-title text-lg font-bold text-on-surface">{title}</h3>
          {subtitle ? <p className="sv-analytics-chart-subtitle text-xs text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {loading ? (
        <div className="sv-analytics-chart-skeleton h-64 animate-pulse rounded-md bg-surface-container-low" />
      ) : hasData ? (
        children
      ) : (
        <div className="sv-analytics-chart-empty flex h-64 items-center justify-center rounded-md bg-surface-container-low text-sm text-on-surface-variant">{emptyText}</div>
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
    <div className="sv-analytics-tooltip rounded-md border border-outline-variant/25 bg-surface px-3 py-2 text-xs shadow-lg">
      {label ? <p className="sv-analytics-tooltip-label mb-1 font-semibold text-on-surface">{label}</p> : null}
      <div className="sv-analytics-tooltip-list space-y-1">
        {payload.map((row) => (
          <div key={row.dataKey} className="sv-analytics-tooltip-row flex items-center justify-between gap-3">
            <span className="sv-analytics-tooltip-key text-on-surface-variant">{row.name || row.dataKey}</span>
            <span className="sv-analytics-tooltip-value font-semibold text-on-surface">{formatter(row.value, row.name || row.dataKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
