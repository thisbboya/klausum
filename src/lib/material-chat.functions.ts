import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { withGeminiRetry, PRO_MODEL } from "./ai-gateway";
import { getUserIdFromToken } from "./server-auth";

const ChatInput = z.object({
  accessToken: z.string(),
  materialTitle: z.string().max(300),
  subject: z.string().max(100).optional(),
  level: z.string().max(100).optional(),
  currentPage: z.number().int().min(1).max(10000),
  totalPages: z.number().int().min(1).max(10000),
  currentPageText: z.string().max(20000),
  fullDocumentText: z.string().max(40000).optional(),
  pageIndex: z.string().max(35000).optional(),
  selection: z.string().max(2000).optional(),
  userPrimaryStyle: z.string().max(50).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "ai"]),
        content: z.string().max(8000),
        page: z.number().int().optional(),
      }),
    )
    .max(12)
    .optional(),
  question: z.string().min(1).max(4000),
});

const STYLE_HINTS: Record<string, string> = {
  Visual: 'Use spatial descriptions, reference structure. Say "Notice how..." and "Picture this..."',
  Auditory: 'Use conversational tone. Say "Think of it this way..." and "Let me walk you through..."',
  Reading: "Use precise definitions, numbered steps, structured prose.",
  Kinesthetic: 'Ground everything in real examples. Say "In practice..." and "Try thinking about..."',
};

export const chatWithMaterial = createServerFn({ method: "POST" })
  .inputValidator((d) => ChatInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    

    const styleHint = STYLE_HINTS[data.userPrimaryStyle ?? "Reading"] ?? STYLE_HINTS.Reading;

    const history = (data.history ?? [])
      .map(
        (m) =>
          `${m.role === "user" ? `Student (p.${m.page ?? "?"})` : "Klausum"}: ${m.content}`,
      )
      .join("\n\n");

    const indexBlock = data.pageIndex
      ? `\n═══ PAGE INDEX (for cross-page search) ═══\nEach line is [p.N] followed by a snippet of that page. Use this to locate concepts across the document.\n${data.pageIndex}\n`
      : "";

    const selectionBlock = data.selection
      ? `\n═══ STUDENT HIGHLIGHTED (page ${data.currentPage}) ═══\n"""${data.selection}"""\nTreat this passage as the explicit subject of their question unless they say otherwise.\n`
      : "";

    const system = `You are Klausum — a warm, knowledgeable study companion for a ${data.level ?? "student"} studying "${data.materialTitle}" (${data.subject ?? "General"}).

═══ PAGE AWARENESS — CRITICAL ═══
The student is CURRENTLY ON PAGE ${data.currentPage} of ${data.totalPages}.

EXACT TEXT ON PAGE ${data.currentPage}:
"""
${data.currentPageText || "(This page appears to be visual/image-based with no extractable text)"}
"""
${selectionBlock}
Rules:
1. Always know which page they're on. Reference it: "On page ${data.currentPage}..."
2. Answer "this page", "this paragraph", "this line" using the EXACT text above.
3. When you reference any other page, write it as [p.N] (e.g. [p.12]) so the UI can render a jump button.
4. If asked "where is X mentioned?", scan the PAGE INDEX below and list every matching page as [p.N].
5. Break complex things down concept by concept.

═══ FULL DOCUMENT CONTEXT (truncated) ═══
${(data.fullDocumentText ?? "").substring(0, 8000)}
${indexBlock}
═══ STYLE ═══
${styleHint}
- Use **bold** for KEY TERMS.
- Use LaTeX $...$ for math.
- Maximum 4 paragraphs unless deeply needed.
- End with ONE Socratic follow-up question.
- When they get something right: "Ayekoo! 🎉"
- Never make them feel stupid.`;

    const prompt = `${system}

═══ CONVERSATION HISTORY ═══
${history || "(First message in this session)"}

═══ NEW MESSAGE ═══
Student (currently on page ${data.currentPage} of ${data.totalPages}): ${data.question}

Klausum:`;

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 1200,
      maxRetries: 2,
    });

    return { reply: result.text.trim() };
  });
