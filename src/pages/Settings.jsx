import React, { useState, useEffect, useRef, useCallback } from 'react';
import { entities } from '@/api/firestoreService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Ruler, MapPin, BellRing, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import LoadingScreen from '@/components/ui/LoadingScreen';
import FloodSwitch from '@/components/ui/FloodSwitch';

function SettingRow({ icon: Icon, iconBg, iconBgOff, iconColor, iconColorOff, title, description, control, isOn }) {
  const bg = isOn === undefined ? iconBg : (isOn ? iconBg : (iconBgOff || 'bg-white/5'));
  const color = isOn === undefined ? iconColor : (isOn ? iconColor : (iconColorOff || 'text-gray-500'));
  return (
    <div className="flex items-center gap-3 py-4">
      <div className={`p-2.5 ${bg} rounded-xl flex-shrink-0 transition-colors duration-300`}>
        <Icon className={`w-4 h-4 ${color} transition-colors duration-300`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {control}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      {label && <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 px-1">{label}</p>}
      <div className="bg-[#151a2e] rounded-2xl border border-white/5 px-4 divide-y divide-white/[0.06]">
        {children}
      </div>
    </div>
  );
}

const DEFAULT_SETTINGS = {
  alertRadiusMeters: 300,
  useMetric: true,
  locationEnabled: true,
  notificationsEnabled: true,
  notifyOnAlert: true,
  notifyOnWarn: false,
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const { data: settingsList = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => entities.Settings.list(),
  });

  const serverSettings = settingsList[0] || DEFAULT_SETTINGS;

  // Local state for instant UI response
  const [local, setLocal] = useState(DEFAULT_SETTINGS);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && settingsList.length > 0) {
      setLocal(serverSettings);
      initialized.current = true;
    }
  }, [settingsList]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      if (settingsList[0]?.id) return entities.Settings.update(settingsList[0].id, data);
      return entities.Settings.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  // Debounce saves so rapid changes don't spam the API
  const saveTimer = useRef(null);
  const pendingData = useRef(null);

  const debouncedSave = useCallback((newSettings) => {
    pendingData.current = newSettings;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateMutation.mutate(pendingData.current);
    }, 600);
  }, []);

  const set = (key, value) => {
    const updated = { ...local, [key]: value };
    setLocal(updated); // instant UI
    debouncedSave(updated); // debounced save
  };

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  if (isLoading) return <LoadingScreen message="Loading settings…" />;

  return (
    <div className="min-h-screen bg-[#0c1021] pb-12">
      <PageHeader title="Settings" subtitle="Customize how Flood Finder works" showBack={true} />

      <div className="px-4 py-5 space-y-6 max-w-lg mx-auto">

        {/* Notifications */}
        <Section label="Notifications">
          <SettingRow
            icon={Bell}
            iconBg="bg-amber-500/20"
            iconColor="text-amber-400"
            title="Flood Alerts"
            description={local.notificationsEnabled ? "You'll receive real-time flood alerts" : "Turn on to receive real-time flood alerts"}
            isOn={local.notificationsEnabled}
            control={
              <FloodSwitch checked={local.notificationsEnabled} onCheckedChange={(v) => set('notificationsEnabled', v)} color="#f59e0b" />
            }
          />

          {local.notificationsEnabled && notifPermission === 'default' && (
            <div className="py-3">
              <div className="flex items-center gap-3 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-amber-300 mb-2">Allow notifications for real-time flood alerts.</p>
                  <Button size="sm" onClick={requestPermission} className="bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all text-black text-xs h-7 font-semibold">
                    Allow Notifications
                  </Button>
                </div>
              </div>
            </div>
          )}

          {local.notificationsEnabled && notifPermission === 'granted' && (
            <>
              <SettingRow
                icon={Bell}
                iconBg="bg-red-500/20"
                iconColor="text-red-400"
                title="Severe flooding"
                description="Sensor reaches ALERT level"
                isOn={local.notifyOnAlert}
                control={
                  <FloodSwitch checked={local.notifyOnAlert} onCheckedChange={(v) => set('notifyOnAlert', v)} color="#ef4444" />
                }
              />
              <SettingRow
                icon={Bell}
                iconBg="bg-amber-500/20"
                iconColor="text-amber-400"
                title="Flood warnings"
                description="Sensor reaches WARNING level"
                isOn={local.notifyOnWarn}
                control={
                  <FloodSwitch checked={local.notifyOnWarn} onCheckedChange={(v) => set('notifyOnWarn', v)} color="#f59e0b" />
                }
              />
            </>
          )}
        </Section>

        {/* Preferences */}
        <Section label="Preferences">
          <SettingRow
            icon={Ruler}
            iconBg="bg-purple-500/20"
            iconColor="text-purple-400"
            title="Metric Units"
            description={local.useMetric ? 'Water levels in centimeters' : 'Water levels in inches'}
            isOn={local.useMetric}
            control={
              <FloodSwitch checked={local.useMetric} onCheckedChange={(v) => set('useMetric', v)} color="#a855f7" />
            }
          />
          <SettingRow
            icon={MapPin}
            iconBg="bg-emerald-500/20"
            iconColor="text-emerald-400"
            title="My Location"
            description={local.locationEnabled ? "Showing your position on the map" : "Enable for better flood alerts near you"}
            isOn={local.locationEnabled}
            control={
              <FloodSwitch checked={local.locationEnabled} onCheckedChange={(v) => set('locationEnabled', v)} color="#10b981" />
            }
          />
        </Section>

        {/* About */}
        <Section label="About">
          <SettingRow
            icon={Droplets}
            iconBg="bg-blue-500/20"
            iconColor="text-blue-400"
            title="Flood Finder"
            description="Real-time flood detection · v3.1"
            control={null}
          />
        </Section>

      </div>

    </div>
  );
}