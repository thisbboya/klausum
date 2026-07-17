import { useEffect } from "react";
import { Sounds } from "@/lib/sounds";

/**
 * Global tactile feedback: every chunky 3D button gives a soft click
 * and (on supporting devices) a short haptic tick on press.
 * Delegated on pointerdown so feedback lands at the moment of contact,
 * not after the action resolves — confirming input beats confirming outcome.
 */
export function TactileLayer() {
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (!target?.closest?.(".btn-3d")) return;
      Sounds.tap();
      try {
        navigator.vibrate?.(8);
      } catch {
        // vibration unsupported or blocked — visual/audio feedback still applies
      }
    }
    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  return null;
}
