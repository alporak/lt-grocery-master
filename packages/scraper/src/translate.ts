const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL || "http://localhost:5000";
const EMBEDDER_URL = process.env.EMBEDDER_URL || "http://localhost:8000";

async function translateBatchLLM(
  texts: string[],
  source = "lt",
  target = "en"
): Promise<string[] | null> {
  try {
    const res = await fetch(`${EMBEDDER_URL}/translate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, source, target }),
    });
    if (!res.ok) {
      console.warn(`[Translate] LLM translation returned ${res.status}, falling back to LibreTranslate`);
      return null;
    }
    const data = await res.json();
    if (
      data.translations &&
      Array.isArray(data.translations) &&
      data.translations.length === texts.length
    ) {
      return data.translations;
    }
    console.warn("[Translate] LLM translation returned unexpected shape, falling back");
    return null;
  } catch (err) {
    console.warn("[Translate] LLM translation unavailable, falling back to LibreTranslate:", err);
    return null;
  }
}

async function translateBatchLibre(
  texts: string[],
  source = "lt",
  target = "en"
): Promise<string[]> {
  const results: string[] = [];

  const batchSize = 20;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const translations = await Promise.all(
      batch.map(async (text) => {
        try {
          const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: text, source, target, format: "text" }),
          });
          if (!res.ok) return text;
          const data = await res.json();
          return data.translatedText || text;
        } catch {
          return text;
        }
      })
    );

    results.push(...translations);

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

export async function translateBatch(
  texts: string[],
  source = "lt",
  target = "en"
): Promise<string[]> {
  // Try LLM translation first (higher quality), fall back to LibreTranslate
  const llmResult = await translateBatchLLM(texts, source, target);
  if (llmResult) {
    console.log(`[Translate] Used LLM for ${texts.length} texts`);
    return llmResult;
  }
  console.log(`[Translate] Using LibreTranslate for ${texts.length} texts`);
  return translateBatchLibre(texts, source, target);
}
