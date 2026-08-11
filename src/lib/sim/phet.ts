// PhET simulations, embedded for breadth.
//
// PhET (University of Colorado Boulder) publishes several hundred HTML5
// science simulations under CC-BY, servable in an iframe with no X-Frame or
// frame-ancestors restriction. That is an enormous amount of quality we would
// be foolish to rebuild.
//
// But they are a black box, and it is worth being precise about why that
// matters here. Each sim is cross-origin and exposes no state to the embedder
// without PhET-iO, which is a commercial arrangement. Klausum's challenge
// engine works by reading a simulation's readouts every frame, so a PhET sim
// physically cannot complete a mission, award XP, or report progress.
//
// So these are explicitly the *explore* tier: unlimited breadth, no scoring.
// Anything we want to gamify has to be a native SimModel. Keeping that line
// visible in the UI is deliberate — a student who earns nothing from an
// activity should be told that up front rather than discovering it after.
//
// They are also about 1 MB each. On the mobile data most of our students are
// paying for, that is a real cost, so nothing loads until it is asked for.

export type PhetSim = {
  /** PhET's own id; also forms the URL. */
  id: string;
  title: string;
  subject: "physics" | "chemistry" | "biology" | "maths";
  blurb: string;
};

export const PHET_SIMS: PhetSim[] = [
  // Chemistry
  { id: "acid-base-solutions", title: "Acid–Base Solutions", subject: "chemistry", blurb: "Strong and weak acids, pH, and what's actually in the beaker." },
  { id: "build-a-molecule", title: "Build a Molecule", subject: "chemistry", blurb: "Assemble molecules from atoms and collect them." },
  { id: "balancing-chemical-equations", title: "Balancing Equations", subject: "chemistry", blurb: "Balance by adjusting coefficients and see it settle." },
  { id: "molarity", title: "Molarity", subject: "chemistry", blurb: "Solute, solvent, concentration — and saturation." },
  { id: "states-of-matter-basics", title: "States of Matter", subject: "chemistry", blurb: "Heat it, cool it, compress it, watch the particles." },

  // Physics
  { id: "faradays-law", title: "Faraday's Law", subject: "physics", blurb: "PhET's take — compare it with ours in the Lab." },
  { id: "circuit-construction-kit-dc", title: "Circuit Construction Kit", subject: "physics", blurb: "Build real circuits with batteries, bulbs and resistors." },
  { id: "forces-and-motion-basics", title: "Forces and Motion", subject: "physics", blurb: "Push things, add friction, watch the net force." },
  { id: "projectile-motion", title: "Projectile Motion", subject: "physics", blurb: "Angle, speed, drag — then hit the target." },
  { id: "wave-on-a-string", title: "Wave on a String", subject: "physics", blurb: "Amplitude, frequency, damping, reflection." },
  { id: "energy-skate-park-basics", title: "Energy Skate Park", subject: "physics", blurb: "Kinetic and potential energy, traded back and forth." },

  // Biology
  { id: "natural-selection", title: "Natural Selection", subject: "biology", blurb: "Mutation, predation, and populations over generations." },
  { id: "neuron", title: "Neuron", subject: "biology", blurb: "Stimulate a neuron and watch the ions cross." },
  { id: "gene-expression-essentials", title: "Gene Expression", subject: "biology", blurb: "Transcription and translation, step by step." },

  // Maths
  { id: "graphing-lines", title: "Graphing Lines", subject: "maths", blurb: "Slope and intercept, seen rather than memorised." },
  { id: "trig-tour", title: "Trig Tour", subject: "maths", blurb: "The unit circle and the wave, side by side." },
  { id: "fraction-matcher", title: "Fraction Matcher", subject: "maths", blurb: "Match fractions to shapes and to each other." },
  { id: "calculus-grapher", title: "Calculus Grapher", subject: "maths", blurb: "Draw a function and watch its derivative and integral." },
];

/** PhET's stable "latest" URL for a simulation, English locale. */
export const phetUrl = (id: string) =>
  `https://phet.colorado.edu/sims/html/${id}/latest/${id}_en.html`;

export const phetBySubject = (s: PhetSim["subject"]) => PHET_SIMS.filter((p) => p.subject === s);
