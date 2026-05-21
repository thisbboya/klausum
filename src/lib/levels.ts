// XP → Level mapping (NkyinkyimIQ progression)
// Levels are intentionally Ghanaian-cultural names that match the dark/gold brand.

export type Level = {
  level: number;
  name: string;
  threshold: number; // XP required to reach this level
};

export const LEVELS: Level[] = [
  { level: 1,  name: "Spark",      threshold: 0      },
  { level: 2,  name: "Curious",    threshold: 100    },
  { level: 3,  name: "Learner",    threshold: 300    },
  { level: 4,  name: "Thinker",    threshold: 700    },
  { level: 5,  name: "Scholar",    threshold: 1500   },
  { level: 6,  name: "Adept",      threshold: 3000   },
  { level: 7,  name: "Master",     threshold: 6000   },
  { level: 8,  name: "Sage",       threshold: 12000  },
  { level: 9,  name: "Legend",     threshold: 24000  },
  { level: 10, name: "Nkyinkyim",  threshold: 50000  },
];

export function getLevelInfo(xp: number) {
  const total = Math.max(0, xp);
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (total >= l.threshold) current = l;
    else break;
  }
  const next = LEVELS.find((l) => l.threshold > current.threshold) ?? null;
  const spanStart = current.threshold;
  const spanEnd = next?.threshold ?? current.threshold;
  const intoLevel = total - spanStart;
  const span = Math.max(1, spanEnd - spanStart);
  const progressPct = next ? Math.min(100, (intoLevel / span) * 100) : 100;
  return { current, next, intoLevel, span, progressPct, total };
}
