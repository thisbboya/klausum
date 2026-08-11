// Every simulation the app can run, in one place.
//
// A registry rather than imports scattered through pages: the tutor, the
// reader and the lab all need to look a simulation up by id, and adding
// number fifty should be one line here rather than an edit in four files.
import type { SimModel } from "@/lib/sim/engine";
import { faraday } from "@/lib/sim/models/faraday";
import { titration } from "@/lib/sim/models/titration";

export const SIMULATIONS: SimModel[] = [faraday, titration];

export const simById = (id: string) => SIMULATIONS.find((s) => s.id === id);

export const SUBJECT_LABEL: Record<SimModel["subject"], string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
  maths: "Mathematics",
  circuits: "Circuits",
};
