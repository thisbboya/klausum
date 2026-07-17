import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsStandalone } from "@/hooks/useIsStandalone";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function recentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const ts = Number(v);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < COOLDOWN_MS;
}

export function InstallPrompt() {
  const isStandalone = useIsStandalone();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;
    if (recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari has no beforeinstallprompt — show a tip instead.
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos) {
      const t = window.setTimeout(() => setShowIosTip(true), 4000);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.clearTimeout(t);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [isStandalone]);

  if (isStandalone || hidden) return null;
  if (!deferred && !showIosTip) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferred(null);
    setHidden(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-md items-start gap-3 card-chunky bg-card/95 p-4 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mt-0.5 rounded-lg bg-primary/15 p-2 text-primary">
          {deferred ? <Download className="h-5 w-5" /> : <Share className="h-5 w-5" />}
        </div>
        <div className="flex-1 text-sm">
          <div className="font-semibold">Install Klausum</div>
          {deferred ? (
            <p className="mt-1 text-muted-foreground">
              Add it to your device for a faster, app-like experience.
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              Tap <Share className="-mt-0.5 inline h-3.5 w-3.5" /> Share, then{" "}
              <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          )}
          {deferred && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={install}>
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Maybe later
              </Button>
            </div>
          )}
        </div>
        <button
          aria-label="Dismiss"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
