const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL || "http://localhost:5000";
const EMBEDDER_URL = process.env.EMBEDDER_URL || "http://localhost:8000";

async function translateLLM(
  text: string,
  source = "lt",
  target = "en"
): Promise<string | null> {
  try {
    const res = await fetch(`${EMBEDDER_URL}/translate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text], source, target }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (
      data.translations &&
      Array.isArray(data.translations) &&
      data.translations.length === 1
    ) {
      return data.translations[0];
    }
    return null;
  } catch {
    return null;
  }
}

export async function translate(
  text: string,
  source = "lt",
  target = "en"
): Promise<string> {
  // Try LLM translation first
  const llmResult = await translateLLM(text, source, target);
  if (llmResult) return llmResult;

  // Fall back to LibreTranslate
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
}

export async function translateBatch(
  texts: string[],
  source = "lt",
  target = "en"
): Promise<string[]> {
  if (texts.length === 0) return [];

  // Try LLM batch translation first
  try {
    const res = await fetch(`${EMBEDDER_URL}/translate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, source, target }),
    });
    if (res.ok) {
      const data = await res.json();
      if (
        data.translations &&
        Array.isArray(data.translations) &&
        data.translations.length === texts.length
      ) {
        return data.translations;
      }
    }
  } catch {
    // fall through to LibreTranslate
  }

  // Fall back to LibreTranslate one-by-one
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
