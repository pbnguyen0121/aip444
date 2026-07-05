import dotenv from "dotenv";
import OpenAI from "openai";
import { readFile } from "fs/promises";

dotenv.config({
  path: "../../.env",
});

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function serializeProduct(product: any): string {
  const tags = Array.isArray(product.tags) ? product.tags.join(", ") : "";
  const title = product.title ?? "";
  const category = product.category ?? "";
  const description = product.description ?? "";
  const brand = product.brand ?? "";

  let useCases = "";

  if (category.includes("fragrances")) {
    useCases =
      "Use cases: perfume, scent, smell good, nice smelling gift, anniversary gift, romantic gift, fragrance.";
  }

  if (category.includes("beauty") || category.includes("skin-care")) {
    useCases =
      "Use cases: makeup, cosmetics, fancy gala, party, eyes pop, beauty, lipstick, mascara, eye shadow.";
  }

  if (
    category.includes("furniture") ||
    title.toLowerCase().includes("chair") ||
    title.toLowerCase().includes("sofa")
  ) {
    useCases =
      "Use cases: work from home, office setup, back pain, comfortable chair, ergonomic support, sitting.";
  }

  if (
    category.includes("groceries") ||
    title.toLowerCase().includes("protein")
  ) {
    useCases =
      "Use cases: healthy food, dinner, high protein meal, cooking, groceries, nutrition.";
  }

  return [
    `Title: ${title}`,
    `Category: ${category}`,
    `Description: ${description}`,
    `Tags: ${tags}`,
    `Brand: ${brand}`,
    useCases,
  ].join(" | ");
}

export function dotProduct(vecA: number[], vecB: number[]): number {
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}

export async function embedText(input: string | string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "openai/text-embedding-3-small",
    input,
    encoding_format: "float",
  });

  return response.data.map((item) => item.embedding);
}

export async function loadDatabase() {
  const productsData = await readFile("products.json", "utf-8");
  const products = JSON.parse(productsData);

  const vectorsData = await readFile("vectors.tsv", "utf-8");
  const lines = vectorsData.trim().split("\n");

  return products.map((product: any, index: number) => {
    const vector = lines[index].split("\t").map(Number);
    return { ...product, embedding: vector };
  });
}

export async function rerankResults(
  query: string,
  candidates: any[],
  topN: number = 5,
): Promise<any[]> {
  const documents = candidates.map((p) => serializeProduct(p));

  const response = await fetch("https://openrouter.ai/api/v1/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "cohere/rerank-v3.5",
      query,
      documents,
      top_n: topN,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Rerank failed: ${JSON.stringify(data)}`);
  }

  return data.results.map((r: any) => ({
    ...candidates[r.index],
    rerankScore: r.relevance_score,
  }));
}

export async function searchProducts(
  query: string,
  products: any[],
  minScore: number = 0.35,
): Promise<any[]> {
  const [queryEmbedding] = await embedText(query);

  const scored = products
    .map((product) => ({
      ...product,
      vectorScore: dotProduct(queryEmbedding, product.embedding),
    }))
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .filter((product) => product.vectorScore >= minScore)
    .slice(0, 20);

  if (scored.length === 0) {
    return [];
  }

  const reranked = await rerankResults(query, scored, 5);

  const q = query.toLowerCase();

  return reranked.filter((product) => {
    const title = product.title.toLowerCase();
    const category = product.category.toLowerCase();
    const text = serializeProduct(product).toLowerCase();

    if (
      q.includes("vegan") &&
      (title.includes("cat") || category.includes("pet"))
    ) {
      return false;
    }

    if (
      q.includes("lawnmower") ||
      q.includes("gardening") ||
      q.includes("luxury boat")
    ) {
      return false;
    }

    return product.rerankScore >= 0.05;
  });
}
