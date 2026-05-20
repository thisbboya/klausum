import { AnimatePresence, motion } from "framer-motion";

export type XPBurstState = {
  show: boolean;
  amount: number;
  x?: number;
  y?: number;
  key?: number;
};

export function XPBurst({ state }: { state: XPBurstState }) {
  return (
    <AnimatePresence>
      {state.show && (
        <motion.div
          key={state.key ?? 0}
          className="fixed pointer-events-none z-[9999] font-bold text-xl text-primary select-none drop-shadow-[0_4px_12px_rgba(244,163,0,0.45)]"
          style={{ left: state.x ?? "50%", top: state.y ?? "50%" }}
          initial={{ opacity: 1, y: 0, scale: 0.8 }}
          animate={{ opacity: 0, y: -80, scale: 1.25 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          +{state.amount} XP ⚡
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useXPBurst() {
  // simple imperative helper consumers can use with their own state
  return null;
}
