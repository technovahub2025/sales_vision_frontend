import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import { ROUTES, projectRoute } from '../../routes/routePaths';
import { AnalyticsTooltip, ChartPanel } from '../../components/analytics/ChartPrimitives';
import RowActionMenu from '../../components/ui/RowActionMenu';
import SelectDropdown from '../../components/ui/SelectDropdown';
import DatePicker from '../../components/ui/DatePicker';
import ExportMenu from '../../components/ui/ExportMenu';
import Icon from '../../components/ui/Icon';

function toDateInputValue(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getPresetRange(preset) {
  const today = new Date();
  const to = toDateInputValue(today);
  const days = preset === '7d' ? 6 : preset === '90d' ? 89 : 29;
  const from = toDateInputValue(new Date(today.getTime() - days * 24 * 60 * 60 * 1000));
  return { from, to };
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatInt(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function shortLabel(value, max = 16) {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function readFileName(contentDisposition, fallback) {
  const text = String(contentDisposition || '');
  const match = text.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

function ChartViewport({ className = '', children }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    let frameId = 0;
    const updateReady = () => {
      frameId = 0;
      const rect = element.getBoundingClientRect();
      setReady(rect.width > 1 && rect.height > 1);
    };
    const scheduleUpdate = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateReady);
    };

    scheduleUpdate();
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(element);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`sv-analytics-chart-wrap ${className}`}>
      <div className="sv-analytics-chart-frame">
        {ready ? children : null}
      </div>
    </div>
  );
}

function AnalyticsResponsiveContainer({ children }) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={1}
      minHeight={1}
      initialDimension={{ width: 1, height: 1 }}
    >
      {children}
    </ResponsiveContainer>
  );
}

function AnalyticsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspaceId, activeWorkspace } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace } = useSocket();
  const refreshTimerRef = useRef(null);

  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState(() => getPresetRange('30d').from);
  const [customTo, setCustomTo] = useState(() => getPresetRange('30d').to);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [openProjectMenuId, setOpenProjectMenuId] = useState('');

  const role = String(activeWorkspace?.role || '').toLowerCase();
  const canExport = role === 'owner' || role === 'admin';

  const params = useMemo(
    () => ({
      dateFrom: customFrom,
      dateTo: customTo,
      ...(moduleFilter && moduleFilter !== 'all' ? { module: moduleFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(channelFilter ? { channel: channelFilter } : {}),
      ...(priorityFilter ? { priority: priorityFilter } : {}),
    }),
    [customFrom, customTo, moduleFilter, statusFilter, channelFilter, priorityFilter],
  );

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'overview', workspaceId, params],
    enabled: Boolean(workspaceId),
    queryFn: () => analyticsApi.overview(workspaceId, params).then((response) => response.data || {}),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!socket || !workspaceId) return undefined;
    const joinPayload = {
      workspaceId,
      modules: ['tasks', 'projects', 'leads', 'campaigns', 'employees', 'clients', 'analytics'],
    };
    joinWorkspace(joinPayload);

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['analytics', 'overview', workspaceId] });
      }, 220);
    };

    const eventNames = [
      EVENTS.REALTIME_EVENT,
      EVENTS.ANALYTICS_UPDATED,
      EVENTS.TASK_CREATED,
      EVENTS.TASK_UPDATED,
      EVENTS.TASK_DELETED,
      EVENTS.PROJECT_UPDATED,
      EVENTS.LEAD_CREATED,
      EVENTS.LEAD_UPDATED,
      EVENTS.LEAD_MOVED,
      EVENTS.LEAD_DELETED,
      EVENTS.CAMPAIGN_CREATED,
      EVENTS.CAMPAIGN_UPDATED,
      EVENTS.CAMPAIGN_DELETED,
      EVENTS.CAMPAIGN_STATUS_CHANGED,
      EVENTS.CLIENT_CREATED,
      EVENTS.CLIENT_UPDATED,
      EVENTS.EMPLOYEE_UPDATED,
      EVENTS.DASHBOARD_UPDATED,
    ];

    eventNames.forEach((name) => socket.on(name, scheduleRefresh));
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      eventNames.forEach((name) => socket.off(name, scheduleRefresh));
      leaveWorkspace(joinPayload);
    };
  }, [socket, workspaceId, joinWorkspace, leaveWorkspace, queryClient]);

  const data = analyticsQuery.data || {};
  const delivery = data.delivery || {};
  const sales = data.sales || {};
  const workforce = data.workforce || {};
  const topEntities = data.topEntities || {};

  const completionTrend = useMemo(() => (
    Array.isArray(delivery.completionTrend) ? delivery.completionTrend : []
  ), [delivery.completionTrend]);
  const overdueTrend = useMemo(() => (
    Array.isArray(delivery.overdueTrend) ? delivery.overdueTrend : []
  ), [delivery.overdueTrend]);
  const leadFunnel = useMemo(() => (
    Array.isArray(sales.leadFunnel) ? sales.leadFunnel : []
  ), [sales.leadFunnel]);
  const topProjects = useMemo(() => (
    Array.isArray(topEntities.projects) ? topEntities.projects : []
  ), [topEntities.projects]);
  const topCampaigns = useMemo(() => (
    Array.isArray(topEntities.campaigns) ? topEntities.campaigns : []
  ), [topEntities.campaigns]);
  const assignmentLoad = useMemo(() => (
    Array.isArray(workforce.assignmentLoad) ? workforce.assignmentLoad : []
  ), [workforce.assignmentLoad]);

  const deliveryTrendData = useMemo(() => {
    const rows = new Map();
    completionTrend.forEach((row) => {
      rows.set(row.date, {
        date: row.date,
        label: String(row.date || '').slice(5),
        completionRate: Number(row.completionRate || 0),
        overdue: 0,
      });
    });
    overdueTrend.forEach((row) => {
      const date = row.date;
      if (!rows.has(date)) {
        rows.set(date, { date, label: String(date || '').slice(5), completionRate: 0, overdue: Number(row.overdue || 0) });
      } else {
        rows.set(date, { ...rows.get(date), overdue: Number(row.overdue || 0) });
      }
    });
    return Array.from(rows.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [completionTrend, overdueTrend]);

  const leadFunnelChartData = useMemo(
    () =>
      leadFunnel.map((row) => ({
        name: String(row.statusId || '').replaceAll('_', ' '),
        value: Number(row.count || 0),
      })),
    [leadFunnel],
  );

  const topPerformanceData = useMemo(() => {
    const projectRows = topProjects.slice(0, 4).map((item) => ({
      label: shortLabel(item.name, 14),
      fullName: item.name,
      projectProgress: Number(item.progress || 0),
      campaignConversion: 0,
      type: 'project',
    }));
    const campaignRows = topCampaigns.slice(0, 4).map((item) => ({
      label: shortLabel(item.name, 14),
      fullName: item.name,
      projectProgress: 0,
      campaignConversion: Number(item.conversionRate || 0),
      type: 'campaign',
    }));
    return [...projectRows, ...campaignRows];
  }, [topProjects, topCampaigns]);

  const workforceChartData = useMemo(
    () =>
      assignmentLoad.slice(0, 8).map((item) => ({
        name: shortLabel(item.name, 12),
        fullName: item.name,
        utilizationPct: Number(item.utilizationPct || 0),
        assignedTasks: Number(item.assignedTasks || 0),
      })),
    [assignmentLoad],
  );

  const openRouteWithParams = useCallback((route, extraParams = {}) => {
    const url = new URLSearchParams({
      dateFrom: customFrom,
      dateTo: customTo,
      ...extraParams,
    });
    navigate(`${route}?${url.toString()}`);
  }, [customFrom, customTo, navigate]);

  const kpiCards = useMemo(
    () => [
      {
        key: 'tasks',
        tone: 'blue',
        icon: 'task_alt',
        label: 'Task Completion',
        value: formatPct(delivery.completionRate),
        hint: 'Completed work in selected range',
        action: 'Open My Tasks',
        onClick: () => openRouteWithParams(ROUTES.myTasks, { status: 'completed' }),
      },
      {
        key: 'leads',
        tone: 'green',
        icon: 'trending_up',
        label: 'Lead Conversion',
        value: formatPct(sales.leadConversionRate),
        hint: 'Won leads against visible pipeline',
        action: 'Open Leads',
        onClick: () => openRouteWithParams(ROUTES.leads, { status: 'won' }),
      },
      {
        key: 'campaigns',
        tone: 'amber',
        icon: 'campaign',
        label: 'Campaign Avg ROI',
        value: `${Number(sales?.campaign?.averageRoi || 0).toFixed(2)}x`,
        hint: 'Average return across campaigns',
        action: 'Open Campaigns',
        onClick: () => openRouteWithParams(ROUTES.campaigns, { status: 'active' }),
      },
      {
        key: 'team',
        tone: 'purple',
        icon: 'groups',
        label: 'Team Utilization',
        value: formatPct(delivery.teamUtilizationPct),
        hint: 'Delivery load across employees',
        action: 'Open Employees',
        onClick: () => openRouteWithParams(ROUTES.employees),
      },
    ],
    [delivery.completionRate, delivery.teamUtilizationPct, sales.leadConversionRate, sales?.campaign?.averageRoi, openRouteWithParams],
  );

  const leadFunnelColors = ['#004ac6', '#1f67dc', '#3b82f6', '#60a5fa', '#93c5fd', '#8b5cf6', '#f97316'];

  const onPresetChange = (nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset === 'custom') return;
    const range = getPresetRange(nextPreset);
    setCustomFrom(range.from);
    setCustomTo(range.to);
  };

  const exportReport = async (format) => {
    if (!workspaceId || !canExport) {
      setToast({ tone: 'error', message: 'Only owner/admin can export detailed analytics.' });
      return;
    }
    try {
      setExporting(format);
      const response = await analyticsApi.export(workspaceId, { ...params, format });
      const fallbackName = `analytics-report-${customFrom}-${customTo}.${format}`;
      const fileName = readFileName(response.headers?.['content-disposition'], fallbackName);
      const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast({ tone: 'success', message: `${format.toUpperCase()} export ready.` });
    } catch (error) {
      setToast({ tone: 'error', message: error?.response?.status === 403 ? 'Export requires owner/admin role.' : 'Export failed. Try again.' });
    } finally {
      setExporting('');
    }
  };

  return (
    <main className="sv-analytics-page relative min-h-screen bg-surface">
      <div className="sv-analytics-container mx-auto space-y-5">
        <section className="sv-card sv-analytics-header flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="sv-analytics-eyebrow">
              <Icon name="monitoring" className="sv-icon-btn-icon" />
              Workspace intelligence
            </span>
            <h1 className="sv-analytics-title text-3xl font-bold tracking-tight text-on-surface">Analytics Overview</h1>
            <p className="sv-analytics-subtitle mt-1 text-on-surface-variant">Workspace 360 for delivery, sales, workforce, and growth.</p>
          </div>
          <div className="sv-analytics-actions flex gap-2">
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((current) => !current)}
              className={`sv-ctl-btn sv-analytics-filter-toggle rounded-lg border border-outline-variant/25 bg-surface px-4 py-2 font-medium text-on-surface transition-colors ${showFilters ? 'is-active' : ''}`}
            >
              <i className="bi bi-sliders2 me-2" />
              Filters
            </button>
            <ExportMenu onExport={exportReport} label={exporting ? `Exporting ${exporting.toUpperCase()}...` : 'Export'} disabled={!canExport || Boolean(exporting)} />
          </div>
        </section>

        <section className={`sv-card sv-analytics-filters rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 ${showFilters ? 'is-open' : 'is-collapsed'}`}>
          <div className="sv-analytics-filters-row flex flex-wrap items-center gap-2">
            {['7d', '30d', '90d', 'custom'].map((item) => (
              <button key={item} type="button" onClick={() => onPresetChange(item)} className={`sv-ctl-btn sv-analytics-preset-chip rounded-md px-3 py-1.5 text-sm font-semibold ${preset === item ? 'is-active bg-primary text-white' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'}`}>
                {item === 'custom' ? 'Custom' : item.toUpperCase()}
              </button>
            ))}
            <DatePicker
              value={customFrom}
              onChange={(nextValue) => { setPreset('custom'); setCustomFrom(nextValue); }}
              className="sv-analytics-filter-input"
              triggerClassName="sv-ctl-input rounded-md border border-outline-variant/25 bg-surface px-3 py-1.5 text-sm"
              placeholder="From"
            />
            <DatePicker
              value={customTo}
              onChange={(nextValue) => { setPreset('custom'); setCustomTo(nextValue); }}
              className="sv-analytics-filter-input"
              triggerClassName="sv-ctl-input rounded-md border border-outline-variant/25 bg-surface px-3 py-1.5 text-sm"
              placeholder="To"
            />
            <SelectDropdown
              value={moduleFilter}
              onChange={setModuleFilter}
              className="sv-analytics-filter-input"
              options={[
                { value: 'all', label: 'All modules' },
                { value: 'delivery', label: 'Delivery' },
                { value: 'sales', label: 'Sales' },
                { value: 'workforce', label: 'Workforce' },
              ]}
            />
            <SelectDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              className="sv-analytics-filter-input"
              options={[
                { value: '', label: 'All status' },
                { value: 'todo', label: 'Todo' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'won', label: 'Won' },
              ]}
            />
            <SelectDropdown
              value={channelFilter}
              onChange={setChannelFilter}
              className="sv-analytics-filter-input"
              options={[
                { value: '', label: 'All channels/sources' },
                { value: 'organic', label: 'Organic' },
                { value: 'referral', label: 'Referral' },
                { value: 'paid', label: 'Paid' },
                { value: 'event', label: 'Event' },
                { value: 'cold', label: 'Cold' },
              ]}
            />
            <SelectDropdown
              value={priorityFilter}
              onChange={setPriorityFilter}
              className="sv-analytics-filter-input"
              options={[
                { value: '', label: 'All priority' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
                { value: 'hot', label: 'Hot' },
                { value: 'warm', label: 'Warm' },
                { value: 'cold', label: 'Cold' },
              ]}
            />
          </div>
        </section>

        <section className="sv-analytics-kpis grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => (
            <article key={card.key} className={`sv-card sv-analytics-kpi is-${card.tone} rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm`}>
              <span className="sv-analytics-kpi-icon">
                <Icon name={card.icon} />
              </span>
              <p className="sv-analytics-kpi-label text-sm text-on-surface-variant">{card.label}</p>
              <h2 className="sv-analytics-kpi-value mt-1 text-3xl font-black text-on-surface" title={card.value}>{card.value}</h2>
              <p className="sv-analytics-kpi-hint">{card.hint}</p>
              <button type="button" onClick={card.onClick} className="sv-analytics-kpi-link mt-3 text-xs font-semibold text-primary hover:underline">
                {card.action}
                <Icon name="arrow_forward" />
              </button>
            </article>
          ))}
        </section>

        <section className="sv-analytics-grid grid grid-cols-12 gap-4">
          <div className="sv-analytics-grid-main col-span-12 lg:col-span-8">
            <ChartPanel
              title="Delivery Trend"
              subtitle="Completion rate and overdue count over time"
              loading={analyticsQuery.isLoading}
              hasData={deliveryTrendData.length > 0}
            >
              <ChartViewport className="h-72">
                <AnalyticsResponsiveContainer>
                  <LineChart data={deliveryTrendData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ef" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip content={<AnalyticsTooltip formatter={(value, key) => (String(key).includes('Rate') ? `${Number(value || 0).toFixed(1)}%` : formatInt(value))} />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="completionRate" name="Completion Rate" stroke="#004ac6" fill="#004ac622" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="overdue" name="Overdue" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 2 }} />
                  </LineChart>
                </AnalyticsResponsiveContainer>
              </ChartViewport>
            </ChartPanel>
          </div>

          <div className="sv-analytics-grid-side col-span-12 lg:col-span-4">
            <ChartPanel title="Lead Funnel" subtitle="Stage-wise lead distribution" loading={analyticsQuery.isLoading} hasData={leadFunnelChartData.some((item) => item.value > 0)}>
              <ChartViewport className="h-72">
                <AnalyticsResponsiveContainer>
                  <PieChart>
                    <Pie data={leadFunnelChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={2}>
                      {leadFunnelChartData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={leadFunnelColors[index % leadFunnelColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<AnalyticsTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </AnalyticsResponsiveContainer>
              </ChartViewport>
            </ChartPanel>
          </div>
        </section>

        <section className="sv-analytics-grid grid grid-cols-12 gap-4">
          <div className="sv-analytics-grid-main col-span-12 xl:col-span-8">
            <ChartPanel
              title="Top Performance"
              subtitle="Projects progress and campaign conversion"
              loading={analyticsQuery.isLoading}
              hasData={topPerformanceData.length > 0}
              actions={
                <button type="button" onClick={() => openRouteWithParams(ROUTES.projects)} className="sv-analytics-inline-link text-xs font-semibold text-primary hover:underline">
                  View all projects
                </button>
              }
            >
              <ChartViewport className="h-64">
                <AnalyticsResponsiveContainer>
                  <AreaChart data={topPerformanceData} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ef" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip content={<AnalyticsTooltip formatter={(value) => `${Number(value || 0).toFixed(1)}%`} />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <defs>
                      <linearGradient id="svTopPerfProj" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="svTopPerfCamp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="projectProgress" name="Project Progress %" stroke="#2563eb" fill="url(#svTopPerfProj)" strokeWidth={2.4} />
                    <Line type="monotone" dataKey="campaignConversion" name="Campaign Conversion %" stroke="#f97316" strokeWidth={2.2} dot={{ r: 2 }} />
                    <Area type="monotone" dataKey="campaignConversion" name="Campaign Conversion Area" stroke="transparent" fill="url(#svTopPerfCamp)" />
                  </AreaChart>
                </AnalyticsResponsiveContainer>
              </ChartViewport>
              <div className="sv-analytics-mini-table mt-3 overflow-x-auto rounded-md border border-outline-variant/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant">
                    <tr>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Progress</th>
                      <th className="px-3 py-2 sv-row-action-heading">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProjects.slice(0, 5).map((project) => (
                      <tr key={project.projectId} className="border-t border-outline-variant/10">
                        <td className="px-3 py-2">
                          <button type="button" className="sv-name-open-btn" onClick={() => navigate(projectRoute('overview', project.projectId))}>
                            {project.name}
                          </button>
                        </td>
                        <td className="px-3 py-2 capitalize">{project.status}</td>
                        <td className="px-3 py-2">{Number(project.progress || 0).toFixed(1)}%</td>
                        <td className="px-3 py-2 sv-row-action-cell">
                          <RowActionMenu
                            open={openProjectMenuId === project.projectId}
                            onTrigger={() => setOpenProjectMenuId((current) => (current === project.projectId ? '' : project.projectId))}
                            onClose={() => setOpenProjectMenuId('')}
                            ariaLabel={`Actions for ${project.name || 'project'}`}
                            items={[
                              {
                                key: 'open',
                                label: 'Open',
                                icon: 'open_in_new',
                                onClick: () => navigate(projectRoute('overview', project.projectId)),
                              },
                            ]}
                            triggerClassName="sv-analytics-mini-trigger"
                            menuClassName="sv-analytics-mini-menu"
                          />
                        </td>
                      </tr>
                    ))}
                    {!topProjects.length ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-center text-on-surface-variant">
                          No project data in this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </ChartPanel>
          </div>

          <div className="sv-analytics-grid-side col-span-12 xl:col-span-4">
            <ChartPanel title="Workforce Capacity" subtitle="Availability and utilization view" loading={analyticsQuery.isLoading} hasData={workforceChartData.length > 0}>
              <ChartViewport className="h-72">
                <AnalyticsResponsiveContainer>
                  <AreaChart data={workforceChartData} margin={{ top: 8, right: 10, left: 0, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ef" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip content={<AnalyticsTooltip formatter={(value, key) => (String(key).includes('Utilization') ? `${Number(value || 0).toFixed(1)}%` : formatInt(value))} />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <defs>
                      <linearGradient id="svWorkAssigned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="svWorkUtil" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area yAxisId="right" type="monotone" dataKey="assignedTasks" name="Assigned Tasks" stroke="#8b5cf6" fill="url(#svWorkAssigned)" strokeWidth={2.1} />
                    <Line yAxisId="left" type="monotone" dataKey="utilizationPct" name="Utilization %" stroke="#14b8a6" strokeWidth={2.3} dot={{ r: 2 }} />
                    <Area yAxisId="left" type="monotone" dataKey="utilizationPct" name="Utilization Area" stroke="transparent" fill="url(#svWorkUtil)" />
                  </AreaChart>
                </AnalyticsResponsiveContainer>
              </ChartViewport>
              <div className="sv-analytics-mini-stats mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="sv-analytics-mini-stat rounded-md bg-surface-container-low px-2 py-2">Headcount: <span className="font-semibold">{formatInt(workforce.headcount)}</span></div>
                <div className="sv-analytics-mini-stat rounded-md bg-surface-container-low px-2 py-2">Avg Capacity: <span className="font-semibold">{Number(workforce.avgCapacityHours || 0).toFixed(1)}h</span></div>
              </div>
            </ChartPanel>
          </div>
        </section>

        <section className="sv-card sv-analytics-campaigns rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
          <div className="sv-analytics-campaigns-head mb-3 flex items-center justify-between">
            <h3 className="sv-analytics-section-title text-lg font-bold text-on-surface">Top Campaigns</h3>
            <button type="button" onClick={() => openRouteWithParams(ROUTES.campaigns)} className="sv-analytics-inline-link text-xs font-semibold text-primary hover:underline">Open campaigns</button>
          </div>
          <div className="sv-analytics-campaigns-grid grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topCampaigns.map((campaign) => (
              <button key={campaign.campaignId} type="button" onClick={() => navigate(ROUTES.campaignDetail.replace(':campaignId', campaign.campaignId))} className="sv-analytics-campaign-card rounded-md border border-outline-variant/20 bg-surface p-3 text-left transition hover:bg-surface-container-low">
                <span className="sv-analytics-campaign-status">{campaign.status || 'draft'}</span>
                <p className="sv-analytics-campaign-title font-semibold">{campaign.name}</p>
                <div className="sv-analytics-campaign-stats mt-2 flex items-center justify-between text-xs">
                  <span>ROI: {Number(campaign.roi || 0).toFixed(2)}x</span>
                  <span>Spend: {formatINR(campaign.spend || 0)}</span>
                </div>
              </button>
            ))}
            {!topCampaigns.length ? <p className="sv-analytics-empty-note text-sm text-on-surface-variant">No campaign data in this range.</p> : null}
          </div>
        </section>

        {analyticsQuery.isLoading ? <div className="sv-analytics-feedback rounded-md bg-surface-container-low p-3 text-sm text-on-surface-variant">Loading analytics...</div> : null}
        {analyticsQuery.error ? <div className="sv-analytics-feedback is-error rounded-md bg-error-container px-3 py-2 text-sm text-error">Failed to load analytics data.</div> : null}
      </div>

      {toast ? (
        <div className={`sv-analytics-toast fixed bottom-5 right-5 z-[60] rounded-lg px-4 py-2 text-sm font-semibold text-white ${toast.tone === 'error' ? 'bg-error is-error' : 'bg-green-600 is-success'}`}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

export default AnalyticsPage;
