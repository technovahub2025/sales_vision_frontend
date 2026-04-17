import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tasksApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

function computePausedSeconds(pausedIntervals = [], nowMs = Date.now()) {
  return (Array.isArray(pausedIntervals) ? pausedIntervals : []).reduce((sum, interval) => {
    if (!interval?.pausedAt) return sum;
    const pausedAtMs = new Date(interval.pausedAt).getTime();
    if (Number.isNaN(pausedAtMs)) return sum;
    const resumedAtMs = interval?.resumedAt ? new Date(interval.resumedAt).getTime() : nowMs;
    if (Number.isNaN(resumedAtMs) || resumedAtMs <= pausedAtMs) return sum;
    return sum + Math.floor((resumedAtMs - pausedAtMs) / 1000);
  }, 0);
}

function computeElapsedSecondsFromLog(log, nowMs = Date.now()) {
  if (!log?.startTime) return 0;
  const startedAtMs = new Date(log.startTime).getTime();
  if (Number.isNaN(startedAtMs)) return 0;
  const totalSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const pausedSeconds = computePausedSeconds(log.pausedIntervals || [], nowMs);
  return Math.max(0, totalSeconds - pausedSeconds);
}

function extractDurationSeconds(log) {
  if (!log) return 0;
  if (Number.isFinite(Number(log.durationSecs))) return Math.max(0, Number(log.durationSecs));
  if (Number.isFinite(Number(log.durationSeconds))) return Math.max(0, Number(log.durationSeconds));
  if (Number.isFinite(Number(log.elapsedSeconds))) return Math.max(0, Number(log.elapsedSeconds));
  if (Number.isFinite(Number(log.durationMins))) return Math.max(0, Math.round(Number(log.durationMins) * 60));
  if (log.startTime && log.endTime) {
    const startMs = new Date(log.startTime).getTime();
    const endMs = new Date(log.endTime).getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      return Math.max(0, Math.floor((endMs - startMs) / 1000) - computePausedSeconds(log.pausedIntervals || [], endMs));
    }
  }
  return 0;
}

export function useTimeTracker(taskId, employeeIdArg) {
  const { workspaceId } = useWorkspace();
  const { socket, joinWorkspace } = useSocket();
  const { user } = useAuth();
  const employeeId = employeeIdArg || user?.id || window.localStorage.getItem('salevision:userId') || '';
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeLogId, setActiveLogId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const timerStateRef = useRef({ baseSeconds: 0, snapshotAtMs: null });

  const hydrateLogs = useCallback(async () => {
    if (!workspaceId || !taskId) return;
    setLoading(true);
    try {
      const response = await tasksApi.listTimeLogs(workspaceId, taskId, employeeId ? { userId: employeeId } : undefined);
      const logsData = response.data || [];
      setLogs(logsData);
      
      // Check for active or paused timer
      const activeLog = logsData.find((log) => !log.endTime && !log.isDeleted);
      if (activeLog) {
        const baseSeconds = computeElapsedSecondsFromLog(activeLog);
        setActiveLogId(String(activeLog._id));
        setElapsedSeconds(baseSeconds);
        if (activeLog.isPaused) {
          setPaused(true);
          setRunning(false);
          timerStateRef.current = { baseSeconds, snapshotAtMs: null };
        } else {
          setRunning(true);
          setPaused(false);
          timerStateRef.current = { baseSeconds, snapshotAtMs: Date.now() };
        }
      } else {
        setActiveLogId(null);
        setRunning(false);
        setPaused(false);
        setElapsedSeconds(0);
        timerStateRef.current = { baseSeconds: 0, snapshotAtMs: null };
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, taskId, employeeId]);

  useEffect(() => {
    hydrateLogs();
  }, [hydrateLogs]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const { baseSeconds, snapshotAtMs } = timerStateRef.current;
      if (!snapshotAtMs) return;
      const elapsed = Math.max(0, baseSeconds + Math.floor((Date.now() - snapshotAtMs) / 1000));
      setElapsedSeconds(elapsed);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!socket || !workspaceId) return;
    joinWorkspace({ workspaceId, modules: ['tasks', 'timeLogs'], entities: taskId ? [{ module: 'tasks', id: taskId }] : [] });

    const onTimerStarted = (payload) => {
      const log = payload?.data;
      if (!log || String(log.taskId) !== String(taskId)) return;
      if (employeeId && log.userId && String(log.userId) !== String(employeeId)) return;
      hydrateLogs();
    };

    const onTimerStopped = (payload) => {
      const log = payload?.data;
      if (!log || String(log.taskId) !== String(taskId)) return;
      if (employeeId && log.userId && String(log.userId) !== String(employeeId)) return;
      hydrateLogs();
    };

    const onTimerPaused = (payload) => {
      const log = payload?.data;
      if (!log || String(log.taskId) !== String(taskId)) return;
      if (employeeId && log.userId && String(log.userId) !== String(employeeId)) return;
      hydrateLogs();
    };

    const onTimerResumed = (payload) => {
      const log = payload?.data;
      if (!log || String(log.taskId) !== String(taskId)) return;
      if (employeeId && log.userId && String(log.userId) !== String(employeeId)) return;
      hydrateLogs();
    };

    const onTimeLogCreated = (payload) => {
      const log = payload?.data;
      if (!log || String(log.taskId) !== String(taskId)) return;
      if (employeeId && log.userId && String(log.userId) !== String(employeeId)) return;
      hydrateLogs();
    };

    socket.on(EVENTS.TIMER_STARTED, onTimerStarted);
    socket.on(EVENTS.TIMER_STOPPED, onTimerStopped);
    socket.on(EVENTS.TIMER_PAUSED, onTimerPaused);
    socket.on(EVENTS.TIMER_RESUMED, onTimerResumed);
    socket.on(EVENTS.TIMELOG_CREATED, onTimeLogCreated);

    return () => {
      socket.off(EVENTS.TIMER_STARTED, onTimerStarted);
      socket.off(EVENTS.TIMER_STOPPED, onTimerStopped);
      socket.off(EVENTS.TIMER_PAUSED, onTimerPaused);
      socket.off(EVENTS.TIMER_RESUMED, onTimerResumed);
      socket.off(EVENTS.TIMELOG_CREATED, onTimeLogCreated);
    };
  }, [socket, workspaceId, taskId, employeeId, joinWorkspace, hydrateLogs]);

  const start = useCallback(async (description = '') => {
    if (!workspaceId || !taskId || !employeeId) return null;
    const response = await tasksApi.startTimer(workspaceId, taskId, { userId: employeeId, description });
    const log = response.data || null;
    if (log) {
      setRunning(true);
      setPaused(false);
      setActiveLogId(String(log._id));
      timerStateRef.current = { baseSeconds: 0, snapshotAtMs: Date.now() };
      setElapsedSeconds(0);
      setLogs((prev) => [log, ...prev.filter((item) => String(item._id) !== String(log._id))]);
    }
    try {
      await tasksApi.updateStatus(workspaceId, taskId, 'in_progress');
    } catch {
      // Don't block timer start when status update fails.
    }
    return log;
  }, [workspaceId, taskId, employeeId]);

  const stop = useCallback(async () => {
    if (!workspaceId || !taskId || !employeeId) return null;
    const response = await tasksApi.stopTimer(workspaceId, taskId, { userId: employeeId });
    const log = response.data || null;
    setRunning(false);
    setPaused(false);
    setActiveLogId(null);
    timerStateRef.current = { baseSeconds: 0, snapshotAtMs: null };
    if (log) {
      const sessionSeconds = extractDurationSeconds(log);
      setLogs((prev) => {
        const nextLogs = [log, ...prev.filter((item) => String(item._id) !== String(log._id))];
        const totalSeconds = nextLogs.reduce((sum, item) => sum + extractDurationSeconds(item), 0);
        setElapsedSeconds(totalSeconds || sessionSeconds || 0);
        return nextLogs;
      });
    } else {
      setElapsedSeconds(0);
    }
    return log;
  }, [workspaceId, taskId, employeeId]);

  const pause = useCallback(async () => {
    if (!workspaceId || !taskId || !employeeId) return null;
    const response = await tasksApi.pauseTimer(workspaceId, taskId, { userId: employeeId });
    const log = response.data || null;
    setPaused(true);
    setRunning(false);
    const baseSeconds = computeElapsedSecondsFromLog(log);
    setElapsedSeconds(baseSeconds);
    timerStateRef.current = { baseSeconds, snapshotAtMs: null };
    if (log) {
      setLogs((prev) => {
        const existing = prev.find((item) => String(item._id) === String(log._id));
        if (existing) {
          return prev.map((item) => (String(item._id) === String(log._id) ? log : item));
        }
        return [log, ...prev];
      });
    }
    return log;
  }, [workspaceId, taskId, employeeId]);

  const resume = useCallback(async () => {
    if (!workspaceId || !taskId || !employeeId) return null;
    const response = await tasksApi.resumeTimer(workspaceId, taskId, { userId: employeeId });
    const log = response.data || null;
    setPaused(false);
    setRunning(true);
    const baseSeconds = computeElapsedSecondsFromLog(log);
    setElapsedSeconds(baseSeconds);
    timerStateRef.current = { baseSeconds, snapshotAtMs: Date.now() };
    if (log) {
      setLogs((prev) => {
        const existing = prev.find((item) => String(item._id) === String(log._id));
        if (existing) {
          return prev.map((item) => (String(item._id) === String(log._id) ? log : item));
        }
        return [log, ...prev];
      });
    }
    return log;
  }, [workspaceId, taskId, employeeId]);

  const addManual = useCallback(async ({ startTime, endTime, description = '' }) => {
    if (!workspaceId || !taskId || !employeeId) return null;
    const response = await tasksApi.createManualTimeLog(workspaceId, taskId, { userId: employeeId, startTime, endTime, description });
    const log = response.data || null;
    if (log) {
      setLogs((prev) => [log, ...prev.filter((item) => String(item._id) !== String(log._id))]);
    }
    return log;
  }, [workspaceId, taskId, employeeId]);

  const totalMins = useMemo(
    () => logs.reduce((sum, item) => sum + Number(item.durationMins || 0), 0),
    [logs],
  );
  const totalSeconds = useMemo(
    () => logs.reduce((sum, item) => sum + extractDurationSeconds(item), 0),
    [logs],
  );

  return useMemo(
    () => ({
      running,
      paused,
      elapsedSeconds,
      totalSeconds,
      activeLogId,
      logs,
      totalMins,
      loading,
      start,
      stop,
      pause,
      resume,
      addManual,
      refresh: hydrateLogs,
    }),
    [running, paused, elapsedSeconds, totalSeconds, activeLogId, logs, totalMins, loading, start, stop, pause, resume, addManual, hydrateLogs],
  );
}
