/*
  Lab 4 Server Summary

  This file creates a small HTTP API server using Hono.
  The server exposes one main endpoint: POST /api/generate.

  A client sends JSON data containing course notes and the number of flashcards
  requested. Before the request reaches the route handler, Zod validates that
  the JSON body has the expected shape.

  If the request is valid, the server calls generateFlashcards(), which sends
  the notes to the LLM and receives structured JSON flashcards back.

  The server then returns those structured flashcards as a JSON response.

  This setup is more realistic than the Lab 2 CLI version because a frontend
  app could now call this API over HTTP.
*/

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { timing } from "hono/timing";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

import { generateFlashcards } from "./flashcard-generator.js";

// Create the Hono app instance. This is similar to creating an Express app.
const app = new Hono();

// logger() prints information about each request.
// timing() adds timing information so we can see how long requests take.
app.use(logger(), timing());

// Enable CORS for API routes so a frontend app can call this backend.
app.use("/api/*", cors());

// Define the expected JSON body for POST /api/generate.
// notes is required, and cards is optional with a default value of 3.
const generateSchema = z.object({
  notes: z.string().min(1, "Field 'notes' is required."),
  cards: z.number().optional().default(3),
});

// POST /api/generate receives notes and returns structured flashcards.
app.post("/api/generate", zValidator("json", generateSchema), async (c) => {
  try {
    // c.req.valid('json') gives us the already validated request body.
    const { notes, cards } = await c.req.valid("json");

    // Call the AI flashcard generation logic.
    const result = await generateFlashcards(notes, cards);

    // Return the structured flashcards as JSON.
    return c.json(result);
  } catch (error: any) {
    // If something fails, log the error on the server side.
    console.error("Server Error:", error);

    // Return a clear JSON error response to the client.
    return c.json(
      {
        error: "Failed to generate flashcards.",
        details: error.message,
      },
      500,
    );
  }
});

// The server listens on port 3000.
const port = 3000;
console.log(`🚀 Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
