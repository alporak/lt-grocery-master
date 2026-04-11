const EMBEDDER_URL = process.env.EMBEDDER_URL || "http://localhost:8000";

export async function translateBatch(
  texts: string[],
  source = "lt",
  target = "en"
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(`${EMBEDDER_URL}/translate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, source, target }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[Translate] LLM translation returned ${res.status}, keeping original names`);
      return texts;
    }
    const data = await res.json();
    if (
      data.translations &&
      Array.isArray(data.translations) &&
      data.translations.length === texts.length
    ) {
      console.log(`[Translate] Translated ${texts.length} texts via LLM`);
      return data.translations;
    }
    console.warn("[Translate] LLM translation returned unexpected shape, keeping original names");
    return texts;
  } catch (err) {
    console.warn("[Translate] LLM translation failed, keeping original names:", err);
    return texts;
  } finally {
    clearTimeout(timeout);
  }
}
