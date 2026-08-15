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
      title: "Five views, not one long page",
      body: "Quests are journeys with a crest at the end. Bench is the simulation you're running. Mine is the ones you asked the tutor for. Circuits is a real solver for R/L/C networks. Explore is a few hundred PhET experiments — good to play with, but they can't award XP because they can't tell us what you did.",
    },
    {
      target: "[data-tour-lab-quest]",
      title: "Quests unlock in order",
      body: "Do this: tap the first step. It opens the right simulation with the mission attached. Finish every step and you keep a crest that cannot be bought at any price.",
    },
  ],

  // ── Sub-pages. These are separate routes, so they get their own tours
  //    rather than being crammed into the parent page's walkthrough.
  "/materials/$id": [
    {
      target: "[data-tour-reader-tabs]",
      title: "One document, six ways to study it",
      body: "Read is the original. Adapted is the same content rewritten for your learning style. Then flashcards, quiz, notes and chat — all built from this one upload, so nothing here needed a second file.",
    },
    {
      target: "[data-tour-highlight]",
      title: "Highlight anything and ask about it",
      body: "Do this: select any sentence in the text. A button appears — tap it and the tutor explains that exact passage, with the rest of the document as context. It is the fastest way out of being stuck on one paragraph.",
    },
    {
      target: "[data-tour-reader-timer]",
      title: "The timer is doing real work",
      body: "It records how long you actually read, which feeds Today's session and your weekly totals. Leave the page and it stops — there is no credit for a tab left open.",
    },
  ],

  "/quizzes/$id/results": [
    {
      target: "[data-tour-results-breakdown]",
      title: "Read the breakdown, not just the score",
      body: "Every question you missed is listed with the right answer and why. How it works: each one also becomes a knowledge gap, so tomorrow's session drills exactly these and nothing else.",
    },
    {
      target: "[data-tour-results-bloom]",
      title: "Bloom levels show HOW you failed",
      body: "Losing marks at Level 1 means you haven't memorised it. Losing them at Level 4 means you know the facts but can't apply them — a completely different fix, and the reason this chart is here.",
    },
  ],

  "/duel/$id": [
    {
      target: "[data-tour-duel-timer]",
      title: "One clock per question",
      body: "It runs down for each question separately. Running out counts as a wrong answer and moves on — there is no going back, which is what makes a duel a duel.",
    },
  ],

  "/community": [
    {
      target: "[data-tour-community-tabs]",
      title: "Five things live here",
      body: "Friends, Leaderboard, Duels, Challenges and Groups. Every one of them is optional — but the students who use them study noticeably more, because someone else is watching.",
    },
    {
      target: "[data-tour-find]",
      title: "Add someone by @handle",
      body: "Do this: search their handle or name, tap Add, and wait for them to accept. Your own handle is in Settings — send it to your class group.",
    },
    {
      target: "[data-tour-boost]",
      title: "Send a friend a boost — it's free",
      body: "Do this: tap Boost on any friend, once a day. They get 25 XP, you get 10. It costs you nothing, which is the point: a gift you pay for out of your own balance just makes people hoard.",
    },
    {
      target: "[data-tour-duels]",
      title: "Duels: same questions, no cheating",
      body: "Do this: open Duels, tap New Duel, pick a friend and one of YOUR materials. Klausum writes fresh questions the moment you send it — they don't exist beforehand, so neither of you can look them up. Each question is timed, and you can share the result when you win.",
    },
    {
      target: "[data-tour-league]",
      title: "The league resets every week",
      body: "You're ranked against a small group, not the whole app, so the person above you is always catchable. Finish near the top and you're promoted; the reset means a bad week is never permanent.",
    },
  ],

  "/gaps": [
    {
      target: "[data-tour-gaps-list]",
      title: "Gaps are what you got wrong",
      body: "Every quiz question you miss becomes a gap, ranked by how badly it hurt. This is the list Today's session drills you on, so it empties itself if you follow the plan.",
    },
    {
      target: "[data-tour-gap-explain]",
      title: "Explain this",
      body: "Do this: tap it on your worst gap. The tutor teaches that one topic from scratch, using your own material. Close the gap and it leaves the list.",
    },
  ],

  "/formulas": [
    {
      target: "[data-tour-formulas]",
      title: "Your own formula sheet",
      body: "Do this: save any formula you keep forgetting. How it works: they're stored with LaTeX, so they render properly, and you can export the whole sheet as a PDF to take into a revision session.",
    },
  ],

  "/videos": [
    {
      target: "[data-tour-video-search]",
      title: "Search, or paste a link",
      body: "Do this: search a topic, or paste any YouTube URL. The chips underneath come from your own uploads, so the first suggestions are about what you're actually studying.",
    },
    {
      target: "[data-tour-video-tabs]",
      title: "Watch & study is the real feature",
      body: "Open a video here rather than on YouTube: Klausum reads its transcript, splits it into chapters, answers questions about it as you watch, and can turn it into a quiz. Your position is saved, so you can leave mid-video.",
    },
  ],

  "/solve": [
    {
      target: "[data-tour-solve]",
      title: "Photograph a problem you're stuck on",
      body: "Do this: take a picture of the question — handwritten is fine. You get the working step by step, not just the answer, so you can find the line where you went wrong.",
    },
  ],

  "/notes": [
    {
      target: "[data-tour-notes-new]",
      title: "Cornell notes, in three panes",
      body: "Do this: make a note and write in the big pane first. Then turn each idea into a question on the left, and finally summarise it at the bottom from memory. That order is the whole method.",
    },
  ],

  "/mindmaps": [
    {
      target: "[data-tour-mindmap]",
      title: "See how ideas connect",
      body: "Do this: generate a map from a material. Useful when a topic has parts that relate to each other — a flat list of notes hides the shape, and the shape is often the thing being examined.",
    },
  ],

  "/schedule": [
    {
      target: "[data-tour-availability]",
      title: "Tell it when you're free",
      body: "Do this: drag across the hours you can actually study. Be honest — a plan built on hours you don't have is the fastest way to abandon it.",
    },
    {
      target: "[data-tour-smart-plan]",
      title: "AI Smart Plan fills the gaps",
      body: "It takes your free hours, your exam dates and what you're behind on, and lays out sessions. You can drag anything afterwards; it's a starting point, not a contract.",
    },
  ],

  "/exams": [
    {
      target: "[data-tour-exam-add]",
      title: "Add your exam dates",
      body: "Do this: add each exam with its date. How it works: the countdown feeds the planner, so revision is scheduled backwards from the exam rather than forwards from today.",
    },
  ],

  "/shop": [
    {
      target: "[data-tour-shop-items]",
      title: "Gems buy time, not answers",
      body: "A streak freeze protects a missed day, hints help on a hard quiz, and a boost doubles XP for half an hour. Nothing here can be bought with money, and nothing gives you a grade you didn't earn.",
    },
  ],

  "/progress": [
    {
      target: "[data-tour-collection]",
      title: "Crests are the things you keep",
      body: "Some are bought with gems, some are earned and can never be bought, and a few only drop from chests. Equip one and it shows beside your name on the leaderboard.",
    },
    {
      target: "[data-tour-heatmap]",
      title: "Ninety days at a glance",
      body: "Each square is a day; darker means more studied. It is the least flattering and most useful chart in the app — gaps in it are the honest record of a bad fortnight.",
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
