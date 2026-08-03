export async function readUrl(url: string): Promise<string> {
  if (!url.trim()) {
    throw new Error("URL cannot be empty.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("URL must use http or https.");
  }

  if (parsedUrl.hostname === "r.jina.ai") {
    throw new Error("Pass the original source URL, not an r.jina.ai URL.");
  }

  const jinaUrl = `https://r.jina.ai/${parsedUrl.toString()}`;

  const response = await fetch(jinaUrl, {
    headers: {
      Accept: "text/markdown",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to read URL. Jina Reader returned ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();

  if (!text.trim()) {
    throw new Error("Jina Reader returned empty content.");
  }

  return text.slice(0, 10_000);
}
