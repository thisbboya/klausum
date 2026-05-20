import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

export function Hearts({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <div className="inline-flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const alive = i < count;
        return (
          <AnimatePresence key={i} mode="wait">
            <motion.span
              key={alive ? "on" : "off"}
              initial={{ scale: alive ? 1 : 1.4, opacity: alive ? 1 : 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <Heart
                className={`h-4 w-4 ${alive ? "fill-red-500 text-red-500" : "text-muted-foreground/30"}`}
              />
            </motion.span>
          </AnimatePresence>
        );
      })}
    </div>
  );
}
