import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStudyMaterials from "./tools/list-study-materials";
import searchLibrary from "./tools/search-library";
import listFlashcardsDue from "./tools/list-flashcards-due";
import listQuestionBank from "./tools/list-question-bank";
import createCornellNote from "./tools/create-cornell-note";
import getStudyStats from "./tools/get-study-stats";

// Use the direct Supabase host as the OAuth issuer (RFC 8414 issuer match).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "klausum-mcp",
  title: "Klausum",
  version: "0.1.0",
  instructions:
    "Klausum is an adaptive AI study companion. Use these tools to read the signed-in student's study materials, flashcards, saved problems, and stats, or to create Cornell notes.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listStudyMaterials,
    searchLibrary,
    listFlashcardsDue,
    listQuestionBank,
    createCornellNote,
    getStudyStats,
  ],
});
