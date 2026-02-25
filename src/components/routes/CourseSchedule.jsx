import React from 'react';
import { Bell, BellOff, Plus, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(val) {
  if (!val) return '';
  const [h, m] = val.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${ampm}`;
}

// Normalize legacy single-window fields into scheduleTimeWindows array
function getTimeWindows(course) {
  if (course.scheduleTimeWindows?.length > 0) return course.scheduleTimeWindows;
  // Fallback for legacy data
  if (course.scheduleStartTime) {
    return [{ startTime: course.scheduleStartTime, endTime: course.scheduleEndTime || '23:59' }];
  }
  return [{ startTime: '08:00', endTime: '18:00' }];
}

export default function CourseSchedule({ course, onUpdate }) {
  const alertsEnabled = course.scheduleEnabled || false;
  const days = course.scheduleDays || [];
  const allTimes = course.scheduleAllTimes !== false;
  const timeWindows = getTimeWindows(course);

  const toggleDay = (day) => {
    const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    onUpdate({ scheduleDays: newDays });
  };

  const allDaysSelected = days.length === DAYS.length;
  const toggleAllDays = () => {
    onUpdate({ scheduleDays: allDaysSelected ? [] : [...DAYS] });
  };

  const updateWindow = (idx, field, value) => {
    const updated = timeWindows.map((w, i) => i === idx ? { ...w, [field]: value } : w);
    onUpdate({ scheduleTimeWindows: updated, scheduleStartTime: updated[0]?.startTime, scheduleEndTime: updated[0]?.endTime });
  };

  const addWindow = () => {
    const last = timeWindows[timeWindows.length - 1];
    const newWindow = { startTime: last?.endTime || '18:00', endTime: '22:00' };
    const updated = [...timeWindows, newWindow];
    onUpdate({ scheduleTimeWindows: updated });
  };

  const removeWindow = (idx) => {
    const updated = timeWindows.filter((_, i) => i !== idx);
    onUpdate({ scheduleTimeWindows: updated, scheduleStartTime: updated[0]?.startTime, scheduleEndTime: updated[0]?.endTime });
  };

  return (
    <div className="bg-[#0c1021] border border-white/8 rounded-2xl overflow-hidden">
      {/* Alerts toggle — always at top */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          {alertsEnabled ? <Bell className="w-4 h-4 text-purple-400" /> : <BellOff className="w-4 h-4 text-gray-500" />}
          <p className="text-sm text-white font-medium">Flood Alerts</p>
        </div>
        <Switch
          checked={alertsEnabled}
          onCheckedChange={(checked) => { onUpdate({ scheduleEnabled: checked }); }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <AnimatePresence>
        {alertsEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {/* Days */}
            <div className="px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active Days</p>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleAllDays(); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {allDaysSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="flex gap-1.5">
                {DAYS.map(day => (
                  <button
                    key={day}
                    onClick={(e) => { e.stopPropagation(); toggleDay(day); }}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95",
                      days.includes(day)
                        ? "bg-blue-500/25 text-blue-300 border border-blue-500/40"
                        : "bg-white/5 text-gray-500 border border-white/5 hover:border-white/15"
                    )}
                  >
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Windows */}
            <div className="px-4 pb-3 border-t border-white/5 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Time</p>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate({ scheduleAllTimes: !allTimes }); }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-all",
                    allTimes
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      : "bg-white/5 text-gray-500 border-white/10 hover:border-white/20"
                  )}
                >
                  {allTimes ? 'All day' : 'Custom'}
                </button>
              </div>

              <AnimatePresence>
                {!allTimes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden space-y-2"
                  >
                    {timeWindows.map((win, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={win.startTime}
                          onChange={(e) => { e.stopPropagation(); updateWindow(idx, 'startTime', e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-[#151a2e] text-white px-3 py-2 rounded-xl text-sm border border-white/10 focus:border-blue-500/60 focus:outline-none"
                        />
                        <span className="text-gray-600 text-sm">→</span>
                        <input
                          type="time"
                          value={win.endTime}
                          onChange={(e) => { e.stopPropagation(); updateWindow(idx, 'endTime', e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-[#151a2e] text-white px-3 py-2 rounded-xl text-sm border border-white/10 focus:border-blue-500/60 focus:outline-none"
                        />
                        {timeWindows.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeWindow(idx); }}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {timeWindows.length < 4 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addWindow(); }}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add time window
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {allTimes && <p className="text-xs text-gray-600">Active all hours on selected days</p>}

              {/* Summary */}
              {days.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {days.join(', ')} · {allTimes ? 'All day' : timeWindows.map(w => `${formatTime(w.startTime)}–${formatTime(w.endTime)}`).join(', ')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}