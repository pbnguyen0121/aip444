import * as z from "zod";

export const FlashcardSchema = z.object({
  application: z
    .string()
    .describe(
      "1-2 sentence real-world workplace task where this concept is needed",
    ),

  challenge: z
    .string()
    .describe(
      "A specific problem to solve in the scenario. All acronyms must be expanded.",
    ),

  answer: z.string().describe("Correct solution with a brief explanation"),

  evidence: z
    .string()
    .describe("Direct quote from the source notes supporting this card"),

  misconception: z
    .string()
    .describe(
      "Quote of what a junior developer or student might incorrectly believe",
    ),

  correction: z
    .string()
    .describe("Why the misconception is wrong, citing the notes"),
});

export const FlashcardResponseSchema = z.object({
  flashcards: z
    .array(FlashcardSchema)
    .describe(
      "List of ACE flashcards generated from the provided course notes",
    ),
});

export type FlashcardResponse = z.infer<typeof FlashcardResponseSchema>;
