import { useEffect, useState } from "react";

export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(display-mode: standalone)");
    const check = () =>
      setStandalone(
        mq.matches ||
          // iOS Safari
          (window.navigator as unknown as { standalone?: boolean }).standalone === true,
      );
    check();
    mq.addEventListener?.("change", check);
    return () => mq.removeEventListener?.("change", check);
  }, []);

  return standalone;
}
