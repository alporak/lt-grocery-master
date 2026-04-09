const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL || "http://localhost:5000";

export async function translateBatch(
  texts: string[],
  source = "lt",
  target = "en"
): Promise<string[]> {
  const results: string[] = [];

  // Process in batches of 20 to avoid overloading
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
          if (!res.ok) return text; // Fallback to original
          const data = await res.json();
          return data.translatedText || text;
        } catch {
          return text; // Fallback to original on error
        }
      })
    );

    results.push(...translations);

    // Small delay between batches
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}
