import React, { useState, useRef } from 'react';
import { X, MapPin, Navigation, Loader2, Clock, Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';



export default function AddCourseForm({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [endCoords, setEndCoords] = useState(null);
  const [activeInput, setActiveInput] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [alertMode, setAlertMode] = useState(null); // null, 'always', 'schedule'
  const [scheduleDays, setScheduleDays] = useState([]);
  const [timeWindows, setTimeWindows] = useState([{ startTime: '08:00', endTime: '18:00' }]);
  const debounceRef = useRef(null);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const searchPlaces = async (query) => {
    if (query.length < 2) { setEndSuggestions([]); return; }
    try {
      const sessionToken = 'ff-' + Date.now();
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}&session_token=${sessionToken}&country=US&limit=5`
      );
      const data = await res.json();
      if (!data.suggestions?.length) throw new Error('no results');
      const detailed = await Promise.all(
        data.suggestions.slice(0, 5).map(async (s) => {
          try {
            const d = await fetch(`https://api.mapbox.com/search/searchbox/v1/retrieve/${s.mapbox_id}?access_token=${MAPBOX_TOKEN}&session_token=${sessionToken}`);
            const dd = await d.json();
            const f = dd.features?.[0];
            if (!f) return null;
            return { name: s.name, secondary: s.place_formatted || '', lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
          } catch { return null; }
        })
      );
      setEndSuggestions(detailed.filter(Boolean));
    } catch {
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=US&types=address,poi&limit=5`);
        const data = await res.json();
        setEndSuggestions((data.features || []).map(f => ({ name: f.text, secondary: f.place_name.split(',').slice(1).join(',').trim(), lat: f.center[1], lng: f.center[0] })));
      } catch { setEndSuggestions([]); }
    }
  };

  const handleAddressChange = (val) => {
    setEndAddress(val);
    setEndCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(val), 300);
  };

  const selectAddress = (s) => {
    setEndAddress([s.name, s.secondary].filter(Boolean).join(', '));
    setEndCoords({ lat: s.lat, lng: s.lng });
    setEndSuggestions([]);
    setActiveInput(null);
  };

  const toggleDay = (day) => {
    setScheduleDays(scheduleDays.includes(day) ? scheduleDays.filter(d => d !== day) : [...scheduleDays, day]);
  };

  const allDaysSelected = scheduleDays.length === DAYS.length;
  const toggleAllDays = () => {
    setScheduleDays(allDaysSelected ? [] : [...DAYS]);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Please enter a location name'); return; }
    if (!endCoords) { setError('Please select a destination from the list'); return; }
    if (!alertMode) { setError('Please select an alert preference'); return; }
    setIsSaving(true);
    setError('');
    await onSave({
      name: name.trim(),
      startAddress: 'Current Location',
      endAddress,
      endLat: endCoords.lat,
      endLng: endCoords.lng,
      scheduleEnabled: alertMode !== 'on-demand',
      scheduleDays: alertMode === 'schedule' ? scheduleDays : (alertMode === 'always' ? DAYS : []),
      scheduleAllTimes: alertMode === 'always',
      scheduleTimeWindows: alertMode === 'schedule' ? timeWindows : [{ startTime: '00:00', endTime: '23:59' }],
      scheduleStartTime: alertMode === 'schedule' ? timeWindows[0]?.startTime : '00:00',
      scheduleEndTime: alertMode === 'schedule' ? timeWindows[0]?.endTime : '23:59',
      routes: [],
    });
    onClose();
    setIsSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-[#151a2e] rounded-xl border border-white/10 p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">Add Location</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/5 rounded">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Location name input */}
      <div>
        <label className="text-xs font-semibold text-gray-400 mb-2 block">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Work, Home, School..."
          className="bg-[#0c1021] border-white/10 text-white placeholder:text-gray-500 text-sm"
          autoFocus
        />
      </div>

      {/* Destination */}
      <div className="relative">
        <label className="text-xs font-semibold text-gray-400 mb-2 block">Where?</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <Input
            value={endAddress}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => setActiveInput('end')}
            placeholder="Search address..."
            className="bg-[#0c1021] border-white/10 text-white placeholder:text-gray-500 pl-10 text-sm"
          />
          {endCoords && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-400" />}
        </div>
        {activeInput === 'end' && endSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1a1f35] border border-white/10 rounded-lg overflow-hidden shadow-xl max-h-56 overflow-y-auto">
            {endSuggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.preventDefault(); selectAddress(s); }}
                className="w-full px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0 flex items-start gap-2.5"
              >
                <MapPin className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-white block font-medium">{s.name}</span>
                  <span className="text-xs text-gray-500 truncate">{s.secondary}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Alert preference */}
      <div>
        <label className="text-xs font-semibold text-gray-400 mb-2 block">Flood Alerts</label>
        <div className="space-y-2">
          <button
            onClick={() => setAlertMode('always')}
            className={`w-full p-3 rounded-lg border transition-colors text-left flex items-center gap-3 text-sm ${
              alertMode === 'always'
                ? 'bg-blue-500/20 border-blue-500/40'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <Bell className={`w-4 h-4 flex-shrink-0 ${alertMode === 'always' ? 'text-blue-400' : 'text-gray-500'}`} />
            <div>
              <div className={`font-medium ${alertMode === 'always' ? 'text-white' : 'text-gray-400'}`}>Alert anytime</div>
              <div className="text-xs text-gray-500">If route gets flooded</div>
            </div>
          </button>

          <button
            onClick={() => setAlertMode('schedule')}
            className={`w-full p-3 rounded-lg border transition-colors text-left flex items-center gap-3 text-sm ${
              alertMode === 'schedule'
                ? 'bg-blue-500/20 border-blue-500/40'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <Clock className={`w-4 h-4 flex-shrink-0 ${alertMode === 'schedule' ? 'text-blue-400' : 'text-gray-500'}`} />
            <div>
              <div className={`font-medium ${alertMode === 'schedule' ? 'text-white' : 'text-gray-400'}`}>Specific times</div>
              <div className="text-xs text-gray-500">Select days & hours</div>
            </div>
          </button>
        </div>
      </div>

      {/* Schedule editor */}
      <AnimatePresence>
        {alertMode === 'schedule' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-white/5 rounded-lg p-3 space-y-3"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase">Days</p>
                <button
                  onClick={toggleAllDays}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {allDaysSelected ? 'Clear' : 'All'}
                </button>
              </div>
              <div className="flex gap-1">
                {DAYS.map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      scheduleDays.includes(day)
                        ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                        : 'bg-white/5 text-gray-500 border border-white/5'
                    }`}
                  >
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-2">Time Windows</p>
              {timeWindows.map((win, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={win.startTime}
                    onChange={(e) => setTimeWindows(prev => prev.map((w, i) => i === idx ? { ...w, startTime: e.target.value } : w))}
                    className="flex-1 bg-[#0c1021] text-white px-2 py-1.5 rounded-lg text-xs border border-white/10 focus:border-blue-500/60 focus:outline-none"
                  />
                  <span className="text-gray-600 text-xs">→</span>
                  <input
                    type="time"
                    value={win.endTime}
                    onChange={(e) => setTimeWindows(prev => prev.map((w, i) => i === idx ? { ...w, endTime: e.target.value } : w))}
                    className="flex-1 bg-[#0c1021] text-white px-2 py-1.5 rounded-lg text-xs border border-white/10 focus:border-blue-500/60 focus:outline-none"
                  />
                  {timeWindows.length > 1 && (
                    <button
                      onClick={() => setTimeWindows(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {timeWindows.length < 4 && (
                <button
                  onClick={() => setTimeWindows(prev => [...prev, { startTime: prev[prev.length - 1]?.endTime || '18:00', endTime: '22:00' }])}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                >
                  + Add another time window
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <div className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</div>}

      <Button
        onClick={handleSave}
        disabled={isSaving || !endCoords || !name.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2"
      >
        {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Save Location</>}
      </Button>
    </motion.div>
  );
}