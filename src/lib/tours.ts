// Per-page walkthroughs.
//
// The first version was one six-step tour of the sidebar, which told a student
// the NAMES of the pages and nothing about how to use any of them. Knowing
// that "Review" exists does not tell you what a loadout is, why the app asks
// you to rate a card Again or Easy, or that a quiz refills your hearts.
//
// So every page gets its own tour, and every step follows the same shape:
//   do this   -> the action
//   what it does -> the immediate result
//   how it works -> the reason, briefly, because a student who understands
//                   the mechanism uses it correctly without being policed
//
// Anchors are `data-tour="..."` attributes on the real controls. A step whose
// anchor is missing is skipped rather than breaking the tour, so a page can
// change without this file becoming a liability.
export type TourStep = {
  target: string;
  title: string;
  body: string;
};

export const PAGE_TOURS: Record<string, TourStep[]> = {
  "/dashboard": [
    {
      target: '[data-tour="/materials"]',
      title: "Everything starts with a material",
      body: "Upload a PDF, slides, or a photo of your notes. Klausum reads it and builds your flashcards, quizzes and summaries from it — nothing else in the app works until something is in here.",
    },
    {
      target: "[data-tour-session]",
      title: "Today's session tells you what to do",
      body: "Do this: tap Start. It runs the short list top to bottom — cards due first, then your weakest topic, then a quiz. It is built fresh each morning from what you actually owe, so you never have to decide where to begin.",
    },
    {
      target: "[data-tour-calling]",
      title: "Write down why you're doing this",
      body: "Do this: tap it and write one sentence. It shows up again at the end of a review session, which is exactly when people quit. Points get you through a night; a reason gets you through a semester.",
    },
    {
      target: "[data-tour-chest]",
      title: "The chest, and what's really in it",
      body: "Finish all three daily quests to unlock it. The odds are printed on the front before you open it — XP, gems, and a rare crest you cannot buy. Nothing is hidden from you, so it's anticipation rather than a slot machine.",
    },
  ],

  "/materials": [
    {
      target: "[data-tour-upload]",
      title: "Upload anything readable",
      body: "Do this: tap Upload Material and pick a PDF, Word file, slides, or a photo. How it works: Klausum extracts the text, then rewrites it for your learning style and cuts it into key concepts — that one pass is what feeds the flashcards, the games and the quizzes.",
    },
    {
      target: "[data-tour-course]",
      title: "Courses are folders",
      body: "Do this: make one per subject. Each card shows the first lines of the documents inside and a bar for how far through them you are, so you can see at a glance which course you've been neglecting.",
    },
    {
      target: "[data-tour-join]",
      title: "Share a course with your class",
      body: "Do this: open a course, tap its share code, and send it to a friend. They enter it under Join course and get every material in it. One person uploads a lecture, everybody studies it.",
    },
  ],

  "/review": [
    {
      target: "[data-tour-loadout]",
      title: "Pick how hard the session will be",
      body: "Do this: choose up to two tactics before you start. Each one genuinely changes the session — Blind Recall removes hints, Sudden Death leaves you one heart, Deep End puts your worst cards first — and each multiplies the XP. Or take none; that's a real choice too.",
    },
    {
      target: "[data-tour-rating]",
      title: "Rate yourself honestly",
      body: "Do this: after seeing the answer, say how it felt. How it works: Klausum uses FSRS, which schedules each card for the day you're about to forget it. Rating things Easy when they weren't is only cheating yourself out of the reminder.",
    },
    {
      target: "[data-tour-hearts]",
      title: "Hearts are the safety net",
      body: "You lose one for every Again. At zero the session pauses for five minutes — or you can take a quiz, which refills them instantly. It exists to stop you grinding a card you clearly don't know yet.",
    },
  ],

  "/tutor": [
    {
      target: "[data-tour-context]",
      title: "Point it at your own material",
      body: "Do this: pick a material from the dropdown. The tutor then answers from YOUR notes rather than in general — ask it 'explain page 4' and it knows what page 4 says.",
    },
    {
      target: "[data-tour-mode]",
      title: "Standard explains, Socratic asks",
      body: "Standard gives you the answer with a worked example. Socratic refuses to, and asks one question at a time until you get there yourself. Use Socratic the night before an exam — it finds the holes.",
    },
    {
      target: "[data-tour-composer]",
      title: "Ask for a picture, a graph, or a simulation",
      body: "Do this: say 'simulate a pendulum' or 'draw how a transformer works'. It builds a real thing you can drag, not a wall of text — and you can save any simulation it makes straight into your Lab.",
    },
    {
      target: "[data-tour-history]",
      title: "Nothing is lost",
      body: "Every conversation is saved. Tap History to reopen one exactly where you left it, months later.",
    },
  ],

  "/quizzes": [
    {
      target: "[data-tour-generate]",
      title: "Quizzes come from your own material",
      body: "Do this: pick a material and generate. You get a mix of multiple-choice, true/false and fill-in-the-blank, spread across Bloom levels — recall questions AND questions that make you apply the idea.",
    },
    {
      target: "[data-tour-attempts]",
      title: "Your history is a study tool",
      body: "Every attempt is kept with its score. Anything you got wrong becomes a knowledge gap, which is what Today's session drills you on tomorrow.",
    },
  ],

  "/lab": [
    {
      target: "[data-tour-lab-tabs]",
      title: "Four views, not one long page",
      body: "Quests are journeys with a crest at the end. Bench is the simulation you're running. Mine is the ones you asked the tutor for. Explore is a few hundred PhET experiments — good to play with, but they can't award XP because they can't tell us what you did.",
    },
    {
      target: "[data-tour-lab-quest]",
      title: "Quests unlock in order",
      body: "Do this: tap the first step. It opens the right simulation with the mission attached. Finish every step and you keep a crest that cannot be bought at any price.",
    },
  ],

  "/community": [
    {
      target: "[data-tour-boost]",
      title: "Send a friend a boost — it's free",
      body: "Do this: tap Boost on any friend, once a day. They get 25 XP, you get 10. It costs you nothing, which is the point: a gift you pay for makes people hoard.",
    },
    {
      target: "[data-tour-league]",
      title: "The league resets weekly",
      body: "You're ranked against a small group, not the whole app, so the person above you is always catchable. Finish high and you're promoted.",
    },
  ],

  "/progress": [
    {
      target: "[data-tour-collection]",
      title: "Crests are the things you keep",
      body: "Some are bought with gems, some are earned and can never be bought, and a few only drop from chests. Equip one and it shows beside your name on the leaderboard.",
    },
  ],

  "/games": [
    {
      target: "[data-tour-game-pick]",
      title: "Games are built from your key concepts",
      body: "Do this: pick a material, then a game. Matching pairs terms to definitions against the clock; Guess the Term goes the other way. Both are retrieval practice — the single most effective way to revise — with the boring parts removed.",
    },
  ],
};
