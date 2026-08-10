// Klausum's own toast system. Replaces the stock sonner look entirely.
//
// Two things it does that the old one didn't:
//  1. Chunky Duolingo-style cards that match the rest of the app (2px border,
//     3D bottom edge, coloured icon tile, hairline countdown).
//  2. Errors are sanitised at the *renderer*, not at each call site — a raw
//     stack trace physically cannot reach a student's screen.
import { AnimatePresence, motion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type NotifyVariant = "success" | "error" | "info" | "warning";

export type NotifyItem = {
  id: number;
  variant: NotifyVariant;
  title: string;
  description?: string;
  duration: number;
};

/* ───────────────────────── store ───────────────────────── */

const MAX_VISIBLE = 3;
let items: NotifyItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshot() {
  return items;
}

const EMPTY: NotifyItem[] = [];
function serverSnapshot() {
  return EMPTY;
}

export function pushNotification(item: Omit<NotifyItem, "id">): number {
  const id = nextId++;
  // Collapse an identical message that is already on screen instead of
  // stacking duplicates — a retry loop shouldn't bury the page.
  const duplicate = items.find((i) => i.title === item.title && i.variant === item.variant);
  if (duplicate) {
    items = items.filter((i) => i.id !== duplicate.id);
  }
  items = [...items, { ...item, id }].slice(-MAX_VISIBLE);
  emit();
  if (item.duration > 0) {
    setTimeout(() => dismissNotification(id), item.duration);
  }
  return id;
}

export function dismissNotification(id?: number) {
  items = id === undefined ? [] : items.filter((i) => i.id !== id);
  emit();
}

/* ───────────────────────── renderer ───────────────────────── */

const VARIANTS: Record<
  NotifyVariant,
  { icon: typeof CheckCircle2; tile: string; edge: string; bar: string }
> = {
  success: {
    icon: CheckCircle2,
    tile: "bg-success/15 text-success",
    edge: "shadow-[0_3px_0_0_var(--edge-success,rgba(0,0,0,0.15))]",
    bar: "bg-success",
  },
  error: {
    icon: XCircle,
    tile: "bg-destructive/15 text-destructive",
    edge: "shadow-[0_3px_0_0_var(--edge-destructive,rgba(0,0,0,0.15))]",
    bar: "bg-destructive",
  },
  info: {
    icon: Info,
    tile: "bg-sky/15 text-sky",
    edge: "shadow-[0_3px_0_0_var(--edge-sky,rgba(0,0,0,0.15))]",
    bar: "bg-sky",
  },
  warning: {
    icon: AlertTriangle,
    tile: "bg-primary/20 text-primary-foreground",
    edge: "shadow-[0_3px_0_0_var(--edge-primary)]",
    bar: "bg-primary",
  },
};

function Card({ item }: { item: NotifyItem }) {
  const v = VARIANTS[item.variant];
  const Icon = v.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90) dismissNotification(item.id);
      }}
      role="status"
      aria-live={item.variant === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border-2 border-border bg-card ${v.edge}`}
    >
      <div className="flex items-start gap-3 px-3 py-3 pr-9">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${v.tile}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-snug text-foreground break-words">
            {item.title}
          </p>
          {item.description && (
            <p className="mt-0.5 text-xs font-semibold leading-snug text-muted-foreground break-words">
              {item.description}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => dismissNotification(item.id)}
        aria-label="Dismiss"
        className="absolute right-2 top-2.5 rounded-lg p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {item.duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: item.duration / 1000, ease: "linear" }}
          className={`absolute bottom-0 left-0 h-[3px] w-full origin-left ${v.bar}`}
        />
      )}
    </motion.div>
  );
}

export function Notifications() {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-[100] flex flex-col-reverse gap-2
                 bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)]
                 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-[368px] sm:flex-col"
    >
      <AnimatePresence initial={false}>
        {list.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}
