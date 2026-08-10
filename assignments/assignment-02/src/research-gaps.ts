import { webSearch } from "./tools/web-search.js";

import type { GapAnalysis } from "./schemas/gap-analysis.js";

export async function researchGapActions(analysis: GapAnalysis) {
  const research: Record<string, string[]> = {};

  for (const gap of analysis.gaps) {
    const query = `${gap.gap} beginner learning path certification project software developer Canada`;

    console.error(`[DEBUG] Gap research: "${query}"`);

    try {
      const result = await webSearch(query, 3);

      research[gap.gap] = result.results.map(
        (item) => `${item.title}: ${item.content}`,
      );
    } catch (error) {
      console.error(`[WARN] Research failed for ${gap.gap}`);

      research[gap.gap] = [];
    }
  }

  return research;
}
