import {
  ChromaClient,
  type Collection,
  type EmbeddingFunction,
  type Metadata,
} from "chromadb";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({
  path: "../../.env",
});

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const COLLECTION_NAME = "node-docs";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

export const RERANK_MODEL = process.env.RERANK_MODEL ?? "cohere/rerank-v3.5";

export const LLM_MODEL =
  process.env.LLM_MODEL ?? "google/gemini-3.1-flash-lite-preview";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error("Missing OPENROUTER_API_KEY. Add it to the .env file.");
}

/**
 * OpenAI-compatible client pointed at OpenRouter.
 */
export const openRouter = new OpenAI({
  apiKey,
  baseURL: OPENROUTER_BASE_URL,
});

/**
 * Custom Chroma embedding function.
 *
 * Chroma calls generate() when documents or query text need
 * to be converted into vectors.
 */
export class OpenRouterEmbeddingFunction implements EmbeddingFunction {
  readonly name = "openrouter-text-embedding-3-small";

  async generate(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await openRouter.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

export const embeddingFunction = new OpenRouterEmbeddingFunction();

/**
 * Chroma HTTP client.
 *
 * The Chroma server must already be running at localhost:8000.
 */
export const chromaClient = new ChromaClient({
  host: "localhost",
  port: 8000,
  ssl: false,
});

/**
 * Get or create the node-docs collection.
 *
 * Cosine distance is used:
 * smaller distance = better match.
 */
export async function getNodeDocsCollection(): Promise<Collection> {
  return chromaClient.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction,
    configuration: {
      hnsw: {
        space: "cosine",
      },
    },
  });
}

export interface RetrievedChunk {
  id: string;
  document: string;
  metadata: Metadata;
  chromaRank: number;
  chromaDistance: number;
  chromaSimilarity: number;
}

export interface RerankedChunk extends RetrievedChunk {
  rerankRank: number;
  relevanceScore: number;
}

/**
 * Retrieve the top candidates from Chroma.
 */
export async function retrieveChunks(
  collection: Collection,
  query: string,
  numberOfResults = 25,
): Promise<RetrievedChunk[]> {
  const results = await collection.query({
    queryTexts: [query],
    nResults: numberOfResults,
    include: ["documents", "metadatas", "distances"],
  });

  const ids = results.ids[0] ?? [];
  const documents = results.documents?.[0] ?? [];
  const metadatas = results.metadatas?.[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  const retrieved: RetrievedChunk[] = [];

  for (let index = 0; index < ids.length; index += 1) {
    const document = documents[index];

    if (!document) {
      continue;
    }

    const distance = distances[index] ?? 1;

    retrieved.push({
      id: ids[index],
      document,
      metadata: metadatas[index] ?? {},
      chromaRank: index + 1,
      chromaDistance: distance,
      chromaSimilarity: 1 - distance,
    });
  }

  return retrieved;
}

interface OpenRouterRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
}

/**
 * Rerank Chroma candidates using OpenRouter's rerank endpoint.
 */
export async function rerankChunks(
  query: string,
  candidates: RetrievedChunk[],
  topN = 5,
): Promise<RerankedChunk[]> {
  if (candidates.length === 0) {
    return [];
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/rerank`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "AIP444 Lab 7 ask-node",
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents: candidates.map((candidate) => candidate.document),
      top_n: Math.min(topN, candidates.length),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `Rerank request failed: ${response.status} ${response.statusText}\n${errorBody}`,
    );
  }

  const data = (await response.json()) as OpenRouterRerankResponse;

  return data.results.map((result, index) => {
    const original = candidates[result.index];

    if (!original) {
      throw new Error(
        `Reranker returned an invalid document index: ${result.index}`,
      );
    }

    return {
      ...original,
      rerankRank: index + 1,
      relevanceScore: result.relevance_score,
    };
  });
}

/**
 * Convert unknown metadata into a safe string.
 */
export function metadataString(
  metadata: Metadata,
  key: string,
  fallback = "unknown",
): string {
  const value = metadata[key];

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return fallback;
}

/**
 * Escape text before inserting it into an XML attribute.
 */
export function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
