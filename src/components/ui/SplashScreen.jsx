import React, { useEffect, useState } from 'react';
import { Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SplashScreen({ onDone }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onDone, 400); // let exit animation finish
    }, 1800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] bg-[#0c1021] flex flex-col items-center justify-center"
        >
          {/* Ripple rings */}
          <div className="relative flex items-center justify-center">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                initial={{ scale: 0.6, opacity: 0.6 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{
                  duration: 2,
                  delay: i * 0.5,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                className="absolute w-20 h-20 rounded-full border border-blue-500/30"
              />
            ))}

            {/* Logo icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40"
            >
              <Droplets className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 text-center"
          >
            <h1 className="text-2xl font-bold text-white tracking-tight">Flood Finder</h1>
            <p className="text-sm text-blue-400/70 mt-1">Real-time flood detection</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
