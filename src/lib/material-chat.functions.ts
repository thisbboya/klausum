import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { resolveModel, PRO_MODEL } from "./ai-gateway";
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
    const model = resolveModel(PRO_MODEL);

    const styleHint = STYLE_HINTS[data.userPrimaryStyle ?? "Reading"] ?? STYLE_HINTS.Reading;

    const history = (data.history ?? [])
      .map(
        (m) =>
          `${m.role === "user" ? `Student (p.${m.page ?? "?"})` : "NkyinkyimIQ"}: ${m.content}`,
      )
      .join("\n\n");

    const system = `You are NkyinkyimIQ — a warm, knowledgeable study companion for a ${data.level ?? "student"} studying "${data.materialTitle}" (${data.subject ?? "General"}).

═══ PAGE AWARENESS — CRITICAL ═══
The student is CURRENTLY ON PAGE ${data.currentPage} of ${data.totalPages}.

EXACT TEXT ON PAGE ${data.currentPage}:
"""
${data.currentPageText || "(This page appears to be visual/image-based with no extractable text)"}
"""

Rules:
1. Always know which page they're on. Reference it: "On page ${data.currentPage}..."
2. Answer "this page", "this paragraph", "this line" using the EXACT text above.
3. If asked about another page, say: "You'll find this on page X — navigate there to follow along."
4. Break complex things down concept by concept.

═══ FULL DOCUMENT CONTEXT (truncated) ═══
${(data.fullDocumentText ?? "").substring(0, 10000)}

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

NkyinkyimIQ:`;

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 1200,
      maxRetries: 2,
    });

    return { reply: result.text.trim() };
  });
