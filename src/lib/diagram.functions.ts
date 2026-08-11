// The picture engine.
//
// Adapted readings are full of [DIAGRAM: ...] markers — the AI describing a
// picture it had no way to draw. Until now those became a line of italic text
// saying "Diagram: how a transformer steps voltage down", which is the one
// thing worse than no diagram: a promise of a picture, unkept, in the middle
// of an explanation.
//
// So we draw it. Mermaid rather than a generated bitmap, deliberately: it is
// vector, it restyles with the theme, it costs a few hundred tokens instead of
// an image-model call, it is readable to a screen reader, and it renders
// through the strict-mode renderer already in the app rather than introducing
// a new way for model output to reach the page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateObjectSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";

const DiagramInput = z.object({
  accessToken: z.string(),
  /** The text inside the marker: what the picture is meant to show. */
  description: z.string().min(3).max(400),
  /** Surrounding material, so the diagram matches what is being taught. */
  context: z.string().max(2000).default(""),
});

const DiagramSchema = z.object({
  /** Raw Mermaid source, no fences. */
  mermaid: z.string(),
  /** Plain-language caption, and the alt text when drawing fails. */
  caption: z.string(),
});

export type GeneratedDiagram = z.infer<typeof DiagramSchema>;

export const generateDiagram = createServerFn({ method: "POST" })
  .inputValidator((d) => DiagramInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);

    const { object } = await generateObjectSafe({
      schema: DiagramSchema,
      maxOutputTokens: 900,
      prompt: `Draw this as a Mermaid diagram for a student.

What it must show: ${data.description}
${data.context ? `\nThe surrounding lesson, for accuracy:\n"""${data.context}"""` : ""}

Pick the diagram type that fits what is being shown:
- ordered steps or a process -> flowchart TD
- parts of a system and how they connect -> flowchart LR
- change over time -> timeline or stateDiagram-v2
- actors exchanging messages -> sequenceDiagram
- a topic breaking into subtopics -> mindmap
- proportions of a whole -> pie

Hard rules, because invalid syntax renders as nothing at all:
- Plain, valid Mermaid only. Never invent syntax.
- Node labels under about six words.
- Quote any label containing brackets, commas, colons or parentheses.
- No styling directives, no click handlers, no HTML inside labels.
- Between 3 and 12 nodes. A diagram with two boxes is not worth drawing.

Return only JSON: {"mermaid": "<source, no fences>", "caption": "<one short sentence>"}`,
    });

    // Models return fenced blocks despite being asked not to, often enough
    // that stripping is cheaper than a retry.
    const mermaid = object.mermaid
      .replace(/^\s*```(?:mermaid)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    return { mermaid, caption: object.caption };
  });
