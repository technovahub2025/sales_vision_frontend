import { useTimeTracker } from '../../hooks/useTimeTracker';

function formatClock(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
}

function TimerButton({ taskId }) {
  const { running, paused, elapsedSeconds, totalSeconds, start, stop, pause, resume, loading } = useTimeTracker(taskId);
  const visibleSeconds = running || paused ? elapsedSeconds : totalSeconds;

  if (!taskId) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-xs font-semibold text-on-surface">
      <span className="rounded bg-surface-container px-2 py-1 font-mono">{formatClock(visibleSeconds)}</span>
      {running ? (
        <>
          <button
            type="button"
            onClick={pause}
            className="rounded bg-amber-100 px-2 py-1 text-amber-700"
            disabled={loading}
          >
            Pause
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded bg-red-100 px-2 py-1 text-red-700"
            disabled={loading}
          >
            End
          </button>
        </>
      ) : paused ? (
        <>
          <button
            type="button"
            onClick={resume}
            className="rounded bg-blue-100 px-2 py-1 text-blue-700"
            disabled={loading}
          >
            Resume
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded bg-red-100 px-2 py-1 text-red-700"
            disabled={loading}
          >
            End
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => start('Quick timer')}
          className="rounded bg-primary/10 px-2 py-1 text-primary"
          disabled={loading}
        >
          Start
        </button>
      )}
    </div>
  );
}

export default TimerButton;
