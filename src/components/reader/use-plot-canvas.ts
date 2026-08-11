import { useEffect, useState } from "react";
import type PlotCanvas from "./PlotCanvas";

/**
 * Loads the chart chunk without React.lazy.
 *
 * lazy() *throws* when a chunk cannot be fetched, and a throw with no error
 * boundary above it unmounts the entire route. That is not hypothetical: a
 * student with the tutor open across a deploy has a stale chunk hash, the fetch
 * 404s, and the whole page became "Something went wrong — Failed to fetch
 * dynamically imported module". A chart that fails to load must cost you the
 * chart, never the conversation.
 *
 * So the import is done by hand: success stores the component, failure stores
 * nothing and the caller simply renders without a chart.
 */
export function usePlotCanvas(): typeof PlotCanvas | null {
  const [Comp, setComp] = useState<typeof PlotCanvas | null>(null);

  useEffect(() => {
    let alive = true;
    void import("./PlotCanvas").then(
      (m) => {
        if (alive) setComp(() => m.default);
      },
      () => {
        /* stale or blocked chunk — degrade to no chart, never crash */
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return Comp;
}
