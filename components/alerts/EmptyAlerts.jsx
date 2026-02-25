import React from 'react';
import { CheckCircle2, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EmptyAlerts() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl" />
        <div className="relative bg-emerald-500/20 p-6 rounded-full">
          <CheckCircle2 className="w-16 h-16 text-emerald-400" />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-2">All Clear</h2>
      <p className="text-gray-400 text-center max-w-xs">
        No flooding detected. All sensors are reporting normal water levels.
      </p>
      
      <div className="flex items-center gap-2 mt-6 px-4 py-2 bg-emerald-500/10 rounded-full">
        <Shield className="w-4 h-4 text-emerald-400" />
        <span className="text-sm text-emerald-400 font-medium">Safe driving conditions</span>
      </div>
    </motion.div>
  );
}