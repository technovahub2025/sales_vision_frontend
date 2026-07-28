import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import SelectDropdown from '../../components/ui/SelectDropdown';
import { leadsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useEmployees } from '../../hooks/useEmployees';
import { ROUTES } from '../../routes/routePaths';

const PRIORITY_OPTIONS = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

const VALID_PRIORITIES = new Set(PRIORITY_OPTIONS.map((item) => item.value));

function normalizePriority(value) {
  const next = String(value || '').toLowerCase();
  return VALID_PRIORITIES.has(next) ? next : 'warm';
}

function normalizeAssigneeId(lead) {
  return String(
    lead?.assigneeId ||
      lead?.assignedEmployeeId ||
      lead?.employeeId ||
      lead?.assignedToId ||
      lead?.assignedEmployee?._id ||
      lead?.assignedTo?._id ||
      '',
  );
}

function getEmployeeLabel(employee) {
  const parts = [employee?.name, employee?.displayName, employee?.email].filter((value) => String(value || '').trim());
  if (!parts.length) return 'Employee';
  return String(parts[0]).trim();
}

function getLeadAssigneeLabel(lead, employeeMap) {
  const assigneeId = normalizeAssigneeId(lead);
  if (!assigneeId) return 'Unassigned';

  const employee = employeeMap.get(assigneeId);
  if (employee) {
    return getEmployeeLabel(employee);
  }

  const directLabel = [
    lead?.assigneeName,
    lead?.assignedEmployeeName,
    lead?.assignedToName,
    lead?.assignedEmployee?.displayName,
    lead?.assignedEmployee?.name,
    lead?.assignedTo?.displayName,
    lead?.assignedTo?.name,
  ].find((value) => String(value || '').trim());

  return String(directLabel || 'Unassigned').trim();
}

function SearchableEmployeeSelect({
  value,
  employees,
  search,
  onSearch,
  onChange,
  hasMore,
  onLoadMore,
  loadingMore,
  currentLabel,
}) {
  const filteredEmployees = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => {
      const haystack = [employee?.name, employee?.displayName, employee?.email, employee?.designation, employee?.department]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, search]);

  return (
    <div className="sv-lead-edit-employee-picker">
      <div className="sv-lead-edit-current">
        <span className="sv-lead-edit-current-label">Current assignee</span>
        <strong>{currentLabel || 'Unassigned'}</strong>
      </div>

      <label className="sv-lead-edit-field-label" htmlFor="lead-assignee-search">
        Search employee
      </label>
      <input
        id="lead-assignee-search"
        type="text"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search by name, email, or department"
        className="sv-ctl-input sv-lead-edit-employee-search"
      />

      <div className="sv-lead-edit-employee-list" role="listbox" aria-label="Employee assignees">
        <button
          type="button"
          className={`sv-lead-edit-employee-item ${String(value || '') === '' ? 'is-active' : ''}`}
          onClick={() => onChange('')}
        >
          <span className="sv-lead-edit-employee-dot" aria-hidden="true" />
          <span>Unassigned</span>
        </button>

        {filteredEmployees.map((employee) => {
          const employeeId = String(employee?._id || '');
          const active = String(value || '') === employeeId;
          return (
            <button
              key={employeeId}
              type="button"
              className={`sv-lead-edit-employee-item ${active ? 'is-active' : ''}`}
              onClick={() => onChange(employeeId)}
            >
              <span className="sv-lead-edit-employee-dot" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{getEmployeeLabel(employee)}</span>
                <span className="block truncate text-xs text-on-surface-variant">
                  {employee?.email || employee?.designation || employee?.department || 'Employee'}
                </span>
              </span>
            </button>
          );
        })}

        {!filteredEmployees.length ? <p className="sv-lead-edit-employee-empty">No matching employees found.</p> : null}
      </div>

      {hasMore ? (
        <button
          type="button"
          className="sv-ctl-btn btn-light sv-icon-btn sv-lead-edit-load-more"
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          <Icon name="expand_more" className="sv-icon-btn-icon" />
          <span>{loadingMore ? 'Loading more...' : 'Load more employees'}</span>
        </button>
      ) : null}
    </div>
  );
}

function LeadEditPage() {
  const navigate = useNavigate();
  const { leadId } = useParams();
  const { workspaceId } = useWorkspace();
  const { items: employees, loading: employeesLoading, loadingMore, hasMore, loadMore } = useEmployees();

  const [lead, setLead] = useState(null);
  const [form, setForm] = useState({ assigneeId: '', priority: 'warm' });
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [loadingLead, setLoadingLead] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const employeeMap = useMemo(
    () => new Map((employees || []).map((employee) => [String(employee?._id || ''), employee])),
    [employees],
  );
  const currentAssigneeLabel = useMemo(() => getLeadAssigneeLabel(lead, employeeMap), [employeeMap, lead]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    let active = true;
    if (!workspaceId || !leadId) {
      setLoadingLead(false);
      setError('Workspace or lead not found.');
      return undefined;
    }

    setLoadingLead(true);
    setError('');
    setSuccess('');

    leadsApi
      .get(workspaceId, leadId)
      .then((response) => {
        if (!active) return;
        const payload = response?.data || null;
        if (!payload) {
          setError('Lead not found.');
          setLead(null);
          return;
        }
        setLead(payload);
        setForm({
          assigneeId: normalizeAssigneeId(payload),
          priority: normalizePriority(payload?.priority || payload?.category),
        });
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError?.message || 'Failed to load lead.');
        setLead(null);
      })
      .finally(() => {
        if (active) setLoadingLead(false);
      });

    return () => {
      active = false;
    };
  }, [leadId, workspaceId]);

  const onSave = async (event) => {
    event.preventDefault();
    if (!workspaceId || !leadId) return;

    const nextPriority = normalizePriority(form.priority);
    setError('');
    setSaving(true);

    try {
      const response = await leadsApi.update(workspaceId, leadId, {
        assigneeId: form.assigneeId || null,
        priority: nextPriority,
      });
      const updatedLead = response?.data || lead;
      setLead(updatedLead);
      setForm({
        assigneeId: normalizeAssigneeId(updatedLead),
        priority: normalizePriority(updatedLead?.priority || updatedLead?.category || nextPriority),
      });
      setSuccess('Lead updated successfully.');
    } catch (nextError) {
      setError(nextError?.message || 'Failed to update lead.');
    } finally {
      setSaving(false);
    }
  };

  const leadTitle = lead?.title || 'Lead';
  const leadSummary = [
    lead?.statusId ? `Stage: ${lead.statusId}` : null,
    lead?.priority ? `Priority: ${normalizePriority(lead.priority)}` : null,
    lead?.updatedAt ? `Updated: ${new Date(lead.updatedAt).toLocaleString()}` : null,
  ].filter(Boolean);

  return (
    <main className="sv-lead-edit-page min-h-screen">
      <div className="sv-lead-edit-shell">
        <section className="sv-card sv-lead-edit-hero">
          <div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.leads)}
              className="sv-lead-edit-back-link"
            >
              <Icon name="arrow_back" className="sv-icon-btn-icon" />
              <span>Back to leads</span>
            </button>
            <p className="sv-lead-edit-eyebrow">Lead Assignment</p>
            <h1 className="sv-lead-edit-title">{leadTitle}</h1>
            <p className="sv-lead-edit-subtitle">
              Update only the assignee and reminder-driving priority. Reminder emails are sent automatically by the backend scheduler when the lead is due.
            </p>
          </div>

          <div className="sv-lead-edit-summary">
            <div className="sv-lead-edit-summary-chip">{lead?.isArchived ? 'Archived' : 'Active'}</div>
            {leadSummary.map((item) => (
              <span key={item} className="sv-lead-edit-summary-text">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="sv-lead-edit-grid">
          <form onSubmit={onSave} className="sv-card sv-lead-edit-panel" aria-busy={saving}>
            <div className="sv-lead-edit-panel-head">
              <div>
                <h2 className="sv-lead-edit-panel-title">Edit Lead</h2>
                <p className="sv-lead-edit-panel-subtitle">Prefilled from the current lead record.</p>
              </div>
              <div className="sv-lead-edit-status">
                {loadingLead ? 'Loading lead...' : saving ? 'Saving...' : 'Ready'}
              </div>
            </div>

            {loadingLead ? (
              <div className="sv-lead-edit-loading">
                <span className="sv-skeleton-line is-wide" />
                <span className="sv-skeleton-line" />
                <span className="sv-skeleton-card" />
              </div>
            ) : null}

            {error ? <p className="sv-lead-edit-alert is-error" role="alert">{error}</p> : null}
            {success ? <p className="sv-lead-edit-alert is-success" role="status">{success}</p> : null}

            {!loadingLead && lead ? (
              <div className="sv-lead-edit-form">
                <div className="sv-lead-edit-field-group">
                  <label className="sv-lead-edit-field-label">Priority</label>
                  <SelectDropdown
                    value={normalizePriority(form.priority)}
                    onChange={(nextValue) => setForm((current) => ({ ...current, priority: normalizePriority(nextValue) }))}
                    options={PRIORITY_OPTIONS}
                    triggerClassName="sv-lead-edit-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm"
                    ariaLabel="Lead priority"
                  />
                  <p className="sv-lead-edit-help">
                    Priority controls how the scheduler decides when reminder emails should go out.
                  </p>
                </div>

                <div className="sv-lead-edit-field-group">
                  <SearchableEmployeeSelect
                    value={form.assigneeId}
                    employees={employees || []}
                    search={assigneeSearch}
                    onSearch={setAssigneeSearch}
                    onChange={(nextValue) => setForm((current) => ({ ...current, assigneeId: String(nextValue || '') }))}
                    hasMore={hasMore}
                    onLoadMore={() => loadMore()}
                    loadingMore={loadingMore || employeesLoading}
                    currentLabel={currentAssigneeLabel}
                  />
                </div>
              </div>
            ) : null}

            <div className="sv-lead-edit-actions">
              <button
                type="button"
                onClick={() => navigate(ROUTES.leads)}
                className="sv-ctl-btn btn-light sv-icon-btn"
                disabled={saving}
              >
                <Icon name="close" className="sv-icon-btn-icon" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={saving || loadingLead || !lead}
                className="sv-ctl-btn btn-primary sv-icon-btn"
              >
                <Icon name="save" className="sv-icon-btn-icon" />
                <span>{saving ? 'Saving...' : 'Save Lead'}</span>
              </button>
            </div>
          </form>

          <aside className="sv-card sv-lead-edit-side">
            <h3 className="sv-lead-edit-side-title">Reminder rules</h3>
            <ul className="sv-lead-edit-side-list">
              <li>The backend scheduler sends reminder emails automatically.</li>
              <li>This screen does not expose a manual send action.</li>
              <li>Updating the assignee or priority is enough to change reminder behavior.</li>
            </ul>
            <div className="sv-lead-edit-side-note">
              <strong>Current values</strong>
              <span>Assignee: {currentAssigneeLabel}</span>
              <span>Priority: {normalizePriority(form.priority)}</span>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default LeadEditPage;
