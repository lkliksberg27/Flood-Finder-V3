import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="min-h-screen bg-[#0c1021] flex flex-col">
      {/* Skeleton header */}
      <div className="px-4 pt-14 pb-4 space-y-3">
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-4 w-56 rounded-md" />
      </div>

      {/* Skeleton cards */}
      <div className="px-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-12 flex-1 rounded-xl" />
              <Skeleton className="h-12 flex-1 rounded-xl" />
              <Skeleton className="h-12 flex-1 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Loading text */}
      <div className="flex justify-center pt-6">
        <p className="text-gray-600 text-xs">{message}</p>
      </div>
    </div>
  );
}
