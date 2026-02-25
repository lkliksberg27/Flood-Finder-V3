import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="min-h-screen bg-[#0c1021] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}