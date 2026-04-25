
#!/usr/bin/env python3
"""
Quick test: send the same 3 products to all configured providers and compare results.
Run from: packages/embedder/
Usage: python test_providers.py
"""
import asyncio, json, os, time
from dotenv import load_dotenv
import httpx
from google import genai

load_dotenv("../../.env")

PROVIDERS =[
    {"name": "Gemini 3.1 Flash Lite", "env": "GEMINI_API_KEY", "is_gemini": True, "model": "gemini-3.1-flash-lite-preview", "json_mode": True},
    {"name": "Groq",       "env": "GROQ_API_KEY",       "url": "https://api.groq.com/openai/v1/chat/completions",        "model": "llama-3.3-70b-versatile",               "json_mode": True, "is_gemini": False},
    {"name": "OpenRouter", "env": "OPENROUTER_API_KEY",  "url": "https://openrouter.ai/api/v1/chat/completions",          "model": "meta-llama/llama-3.3-70b-instruct:free", "json_mode": False, "is_gemini": False},
    {"name": "NVIDIA NIM", "env": "NVIDIA_API_KEY",      "url": "https://integrate.api.nvidia.com/v1/chat/completions",   "model": "meta/llama-3.3-70b-instruct",            "json_mode": False, "is_gemini": False},
    {"name": "GitHub",     "env": "GITHUB_TOKEN",        "url": "https://models.inference.ai.azure.com/chat/completions", "model": "Meta-Llama-3.1-405B-Instruct",           "json_mode": True, "is_gemini": False},
]

TEST_PRODUCTS =[
    {"id": 1, "nameLt": "Rokiškio pienas 2.5% 1L", "storeCategory": "Pieno produktai"},
    {"id": 2, "nameLt": "IKI vištienos filė su česnaku 500g", "storeCategory": "Mėsos gaminiai"},
    {"id": 3, "nameLt": "ALMA gazuotas vanduo citrina 1.5L", "storeCategory": "Gėrimai"},
]

SYSTEM_PROMPT = """You are an expert grocery product analyst specializing in Lithuanian grocery stores (IKI, RIMI, Barbora, Promo Cash & Carry).

For EACH product, return a JSON object. Return all products as: {"results": [{...}, {...}]}

Each object MUST have these fields:
- name_clean: Clean English product name. Format: "[Brand] [Description] [Size]"
- name_lt_clean: Same format but in clean Lithuanian
- brand: Extracted brand name (string or null)
- canonical_category: MUST be one of: poultry, beef, pork, lamb, minced-meat, deli-meat, fish-seafood, milk, cheese, yogurt, butter-cream, cottage-cheese, eggs, bread, bakery, fruits, vegetables, salads-herbs, mushrooms, frozen-food, rice-grains, pasta, flour-baking, oil-vinegar, canned-food, sauces-condiments, snacks, sweets-chocolate, ice-cream, water, soda-soft-drinks, juice, coffee, tea, beer, wine, spirits, cleaning, laundry, paper-products, personal-care, health, baby-food, pet-food, other-food, other-non-food
- subcategory: More specific type (e.g. "fresh", "sparkling", "breast", "lager")
- is_food: boolean
- tags_en: 6-8 English search terms
- tags_lt: 6-8 Lithuanian search terms
- attributes: object with filterable properties

CRITICAL: Return ONLY valid JSON. No markdown. No explanations."""

USER_MSG = "Enrich these products:\n" + "\n".join(
    f"{i+1}. nameLt: {p['nameLt']} | storeCategory: {p['storeCategory']}"
    for i, p in enumerate(TEST_PRODUCTS)
)

async def call_provider(provider: dict) -> dict:
    key = os.getenv(provider["env"])
    if not key:
        return {"name": provider["name"], "error": "No API key", "elapsed": 0}

    start = time.time()
    
    if provider.get("is_gemini"):
        try:
            client = genai.Client(api_key=key)
            resp = await client.aio.models.generate_content(
                model=provider["model"],
                contents=USER_MSG,
                config=genai.types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,
                    response_mime_type="application/json",
                )
            )
            elapsed = round(time.time() - start, 2)
            parsed = json.loads(resp.text)
            return {"name": provider["name"], "elapsed": elapsed, "results": parsed.get("results", [])}
        except Exception as e:
            return {"name": provider["name"], "error": str(e), "elapsed": round(time.time() - start, 2)}

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if provider["name"] == "OpenRouter":
        headers["HTTP-Referer"] = "https://github.com/lt-grocery"
        headers["X-Title"] = "lt-grocery"

    payload = {
        "model": provider["model"],
        "messages":[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_MSG},
        ],
        "temperature": 0.1,
        "max_tokens": 1500,
    }
    if provider["json_mode"]:
        payload["response_format"] = {"type": "json_object"}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(provider["url"], json=payload, headers=headers)
        elapsed = round(time.time() - start, 2)
        if resp.status_code != 200:
            return {"name": provider["name"], "error": f"HTTP {resp.status_code}: {resp.text[:200]}", "elapsed": elapsed}
        raw = resp.json()["choices"][0]["message"]["content"]
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        return {"name": provider["name"], "elapsed": elapsed, "results": parsed.get("results",[])}
    except Exception as e:
        return {"name": provider["name"], "error": str(e), "elapsed": round(time.time() - start, 2)}

async def main():
    print(f"Testing {len(PROVIDERS)} providers with {len(TEST_PRODUCTS)} products...\n")
    tasks = [call_provider(p) for p in PROVIDERS]
    responses = await asyncio.gather(*tasks)

    FIELDS = ["name_clean", "brand", "canonical_category", "subcategory"]

    for resp in responses:
        name = resp["name"]
        elapsed = resp.get("elapsed", "?")
        if "error" in resp:
            print(f"{'='*60}")
            print(f"  {name}  [{elapsed}s]  ERROR: {resp['error']}")
            continue

        print(f"{'='*60}")
        print(f"  {name}[{elapsed}s]")
        print(f"{'='*60}")
        results = resp.get("results",[])
        for i, product in enumerate(TEST_PRODUCTS):
            print(f"\n  Product {i+1}: {product['nameLt']}")
            if i < len(results):
                r = results[i]
                for f in FIELDS:
                    print(f"    {f:22s}: {r.get(f, '—')}")
                tags = r.get("tags_en", [])
                print(f"    {'tags_en':22s}: {', '.join(tags[:4])}{'...' if len(tags) > 4 else ''}")
            else:
                print("    (no result)")
        print()

asyncio.run(main())
