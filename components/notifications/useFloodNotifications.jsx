import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

function isWithinSchedule(course) {
  if (!course.scheduleEnabled) return false;
  const days = course.scheduleDays || [];
  if (days.length === 0) return false;

  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayName = dayNames[now.getDay()];
  if (!days.includes(todayName)) return false;

  if (course.scheduleAllTimes !== false) return true;

  // Check against scheduleTimeWindows (new) or legacy single window
  const windows = course.scheduleTimeWindows?.length > 0
    ? course.scheduleTimeWindows
    : course.scheduleStartTime
      ? [{ startTime: course.scheduleStartTime, endTime: course.scheduleEndTime }]
      : [];

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return windows.some(win => {
    const [sh, sm] = (win.startTime || '00:00').split(':').map(Number);
    const [eh, em] = (win.endTime || '23:59').split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return nowMinutes >= start && nowMinutes <= end;
  });
}

export function useFloodNotifications(settings) {
  const prevStatuses = useRef({});
  const coursesRef = useRef([]);

  useEffect(() => {
    if (!settings?.notificationsEnabled) return;
    if (Notification.permission !== 'granted') return;

    // Bootstrap known sensor states so we don't spam on mount
    base44.entities.Sensor.list().then(sensors => {
      sensors.forEach(s => { prevStatuses.current[s.id] = s.status; });
    });

    // Keep a live reference to courses for schedule checking
    base44.entities.Course.list().then(courses => { coursesRef.current = courses; });
    const courseUnsub = base44.entities.Course.subscribe((event) => {
      if (event.type === 'create') coursesRef.current = [...coursesRef.current, event.data];
      else if (event.type === 'update') coursesRef.current = coursesRef.current.map(c => c.id === event.id ? event.data : c);
      else if (event.type === 'delete') coursesRef.current = coursesRef.current.filter(c => c.id !== event.id);
    });

    const unsubscribe = base44.entities.Sensor.subscribe((event) => {
      if (event.type !== 'update' && event.type !== 'create') return;

      const sensor = event.data;
      const prevStatus = prevStatuses.current[sensor.id];
      const newStatus = sensor.status;
      prevStatuses.current[sensor.id] = newStatus;

      // Only notify on escalation
      const isEscalation =
        (newStatus === 'ALERT' && prevStatus !== 'ALERT') ||
        (newStatus === 'WARN' && prevStatus === 'OK');
      if (!isEscalation) return;

      const shouldNotify =
        (newStatus === 'ALERT' && settings.notifyOnAlert) ||
        (newStatus === 'WARN' && settings.notifyOnWarn);
      if (!shouldNotify) return;

      // Check if any course schedule is currently active
      const hasActiveCourse = coursesRef.current.some(isWithinSchedule);
      // Fire if: no courses exist (global alerts), or at least one course is in its schedule window
      if (coursesRef.current.length > 0 && !hasActiveCourse) return;

      const title = newStatus === 'ALERT'
        ? `🚨 Severe Flooding — ${sensor.name}`
        : `⚠️ Flood Warning — ${sensor.name}`;

      const body = newStatus === 'ALERT'
        ? `Water level: ${sensor.waterLevelCm}cm — Avoid this area`
        : `Water level: ${sensor.waterLevelCm}cm — Exercise caution`;

      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: sensor.id,
        requireInteraction: newStatus === 'ALERT',
      });
    });

    return () => { unsubscribe(); courseUnsub(); };
  }, [settings?.notificationsEnabled, settings?.notifyOnAlert, settings?.notifyOnWarn]);
}