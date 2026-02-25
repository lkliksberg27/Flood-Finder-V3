import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function FloodSwitch({ checked, onCheckedChange, color = '#3b82f6' }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative w-[52px] h-[30px] rounded-full flex-shrink-0 transition-colors duration-300 focus:outline-none',
        checked ? 'shadow-lg' : ''
      )}
      style={{
        backgroundColor: checked ? color : '#1e2340',
        boxShadow: checked ? `0 0 12px ${color}55` : 'none',
      }}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[3px] w-6 h-6 rounded-full bg-white shadow-md"
        style={{ left: checked ? 'calc(100% - 27px)' : '3px' }}
      />
    </button>
  );
}