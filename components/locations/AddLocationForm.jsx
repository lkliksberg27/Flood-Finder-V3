import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';

export default function AddLocationForm({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [alertRadius, setAlertRadius] = useState(500);
  const [alertLevel, setAlertLevel] = useState('WARN');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const searchAddress = (val) => {
    setAddress(val);
    setCoords(null);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${MAPBOX_TOKEN}&limit=5`);
      const data = await res.json();
      setSuggestions(data.features || []);
    }, 350);
  };

  const selectSuggestion = (f) => {
    setAddress(f.place_name);
    setCoords({ lat: f.center[1], lng: f.center[0] });
    setSuggestions([]);
  };

  const handleSave = async () => {
    if (!name || !coords) return;
    setSaving(true);
    await onSave({ name, address, lat: coords.lat, lng: coords.lng, alertRadiusMeters: alertRadius, alertLevel });
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-[#151a2e] border border-white/10 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Add Watched Location</h3>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 rounded"><X className="w-4 h-4" /></button>
      </div>

      <input
        type="text"
        placeholder="Label (e.g. Home, Office)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-[#0c1021] text-white px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
      />

      <div className="relative">
        <input
          type="text"
          placeholder="Address"
          value={address}
          onChange={e => searchAddress(e.target.value)}
          className="w-full bg-[#0c1021] text-white px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-[#1a1f35] border border-white/10 rounded-xl overflow-hidden shadow-xl">
            {suggestions.map(f => (
              <button key={f.id} onClick={() => selectSuggestion(f)} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 border-b border-white/5 last:border-0">
                {f.place_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">Alert radius</label>
          <span className="text-xs text-blue-400 font-semibold">{alertRadius}m</span>
        </div>
        <input
          type="range"
          min={100} max={2000} step={100}
          value={alertRadius}
          onChange={e => setAlertRadius(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600">
          <span>100m</span><span>2km</span>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-400">Alert when sensor reaches</label>
        <div className="flex gap-1.5">
          {[
            { value: 'ANY',   label: 'Any',     emoji: '🔵', activeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
            { value: 'WARN',  label: 'Warning', emoji: '⚠️', activeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
            { value: 'ALERT', label: 'Severe',  emoji: '🚨', activeBg: 'bg-red-500/20 text-red-400 border-red-500/40' },
          ].map(level => (
            <button
              key={level.value}
              onClick={() => setAlertLevel(level.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${alertLevel === level.value
                ? level.activeBg
                : 'bg-white/5 text-gray-500 border-white/5'}`}
            >
              {level.emoji} {level.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!name || !coords || saving}
        className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        Save Location
      </button>
    </motion.div>
  );
}