// Runs a page's walkthrough the first time that page is opened.
//
// Per-page rather than one tour at signup, because a walkthrough delivered
// before you have any materials is a lecture about tools you cannot yet use.
// Shown when you first arrive somewhere, it is instruction at the moment of
// need — and each page is remembered separately, so finishing the Review tour
// never robs you of the Lab one.
import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { PAGE_TOURS } from "@/lib/tours";
import { GuidedTour } from "@/components/tour/GuidedTour";

const KEY = "klausum:pageTours";

function seen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

/** Wipes the record so every page teaches itself again. */
export function resetPageTours() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored, nothing to clear */
  }
}

export function PageTour() {
  const location = useLocation();
  // Match the longest configured route that prefixes the current path, so
  // /materials/<id> still counts as the materials page.
  const route = Object.keys(PAGE_TOURS)
    .filter((r) => location.pathname === r || location.pathname.startsWith(r + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!route) return;
    if (seen()[route]) return;
    // Wait a beat for the page's own data to arrive, otherwise the anchors do
    // not exist yet and every step gets filtered out as missing.
    const t = setTimeout(() => setRun(true), 900);
    return () => {
      clearTimeout(t);
      setRun(false);
    };
  }, [route]);

  if (!route || !run) return null;

  return (
    <GuidedTour
      steps={PAGE_TOURS[route]}
      persist={false}
      onDone={() => {
        setRun(false);
        try {
          localStorage.setItem(KEY, JSON.stringify({ ...seen(), [route]: true }));
        } catch {
          /* it will simply offer itself again next time */
        }
      }}
    />
  );
}
