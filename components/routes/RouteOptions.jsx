import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Navigation, Sparkles, ChevronDown, ChevronUp, TrendingUp, Droplets, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkRouteFlooding } from './courseUtils';

export default function RouteOptions({ routes, sensors, alertRadius, selectedRoute, onSelectRoute }) {
  const [expandedInsight, setExpandedInsight] = useState(null);

  if (!routes || routes.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        No routes generated yet
      </div>
    );
  }

  const smartestRoute = routes.find(r => r.isSmartest);

  return (
    <div className="space-y-2">
      <h4 className="text-xs uppercase text-gray-500 font-medium mb-2">Route Options</h4>

      {/* Smartest Route callout */}
      {smartestRoute?.smartestReason && (
        <div className="flex items-start gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2.5 mb-3">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <p className="text-xs text-violet-300 leading-relaxed">{smartestRoute.smartestReason}</p>
        </div>
      )}

      {routes.map((route, index) => {
        const floodingSensors = checkRouteFlooding(route, sensors, alertRadius);
        const isClear = floodingSensors.length === 0;
        const isSelected = selectedRoute?.id === route.id;
        const hasAlert = floodingSensors.some(s => s.status === 'ALERT');
        const hasInsight = route.aiInsight;
        const isExpanded = expandedInsight === route.id;

        const totalMins = (route.durationMinutes || 0) + (route.trafficPenaltyMinutes || 0);
        const adjustedDuration = totalMins >= 60
          ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
          : `${totalMins} min`;
        const riskColor = route.floodRiskScore == null ? null
          : route.floodRiskScore >= 7 ? 'text-red-400'
          : route.floodRiskScore >= 4 ? 'text-amber-400'
          : 'text-emerald-400';

        // Label logic
        const routeLabel = route.isSmartest
          ? 'Smartest Route'
          : route.isFloodAvoiding
          ? 'Flood-Avoiding Route'
          : index === 0
          ? 'Fastest Route'
          : `Alternative ${index}`;

        return (
          <div key={route.id} className="space-y-0">
            <button
              onClick={(e) => { e.stopPropagation(); onSelectRoute(route); }}
              className={cn(
                "w-full p-3 rounded-xl border transition-all text-left",
                isSelected
                  ? "bg-blue-500/10 border-blue-500/30"
                  : "bg-[#0c1021] border-white/5 hover:border-white/10",
                route.isSmartest && "ring-1 ring-violet-500/40",
                route.isFloodAvoiding && !route.isSmartest && isClear && "ring-1 ring-emerald-500/30"
              )}
            >
              {/* Row 1: label + badges */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  {route.isFloodAvoiding && !route.isSmartest ? (
                    <ShieldCheck className={cn("w-4 h-4 shrink-0", isClear ? "text-emerald-400" : "text-amber-400")} />
                  ) : (
                    <Navigation className={cn(
                      "w-4 h-4 shrink-0",
                      isClear ? "text-emerald-400" : hasAlert ? "text-red-400" : "text-amber-400"
                    )} />
                  )}
                  <span className="text-white font-medium text-sm truncate">{routeLabel}</span>
                  {route.isSmartest && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-500/20 text-violet-300 shrink-0">
                      <Sparkles className="w-3 h-3" />
                      AI Pick
                    </span>
                  )}
                  {route.isFloodAvoiding && !route.isSmartest && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      Detour
                    </span>
                  )}
                </div>

                <div className="shrink-0">
                  {isClear ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Clear
                    </span>
                  ) : (
                    <span className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                      hasAlert ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                    )}>
                      {hasAlert ? <AlertTriangle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {floodingSensors.length} sensor{floodingSensors.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: stats */}
              <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                <span>{route.distanceMiles?.toFixed(1)} mi</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {adjustedDuration}
                  {route.trafficPenaltyMinutes > 0 && (
                    <span className="text-xs text-amber-400 ml-1">+{route.trafficPenaltyMinutes}m traffic</span>
                  )}
                </span>
                {route.floodRiskScore != null && (
                  <span className={cn("flex items-center gap-1 text-xs", riskColor)}>
                    <Droplets className="w-3 h-3" />
                    Risk {route.floodRiskScore}/10
                  </span>
                )}
              </div>
            </button>

            {/* Expandable AI insight */}
            {hasInsight && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpandedInsight(isExpanded ? null : route.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                <TrendingUp className="w-3 h-3" />
                <span>AI insight</span>
                {isExpanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>
            )}
            {hasInsight && isExpanded && (
              <div className="px-3 py-2 bg-[#0c1021] rounded-b-xl border border-t-0 border-white/5 text-xs text-gray-400 leading-relaxed">
                {route.aiInsight}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}