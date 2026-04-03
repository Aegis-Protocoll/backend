import OpenAI from "openai"

let ai: OpenAI | null = null

function getClient(): OpenAI | null {
  if (ai) return ai
  if (!process.env.GROQ_API_KEY) return null
  ai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
  })
  return ai
}

interface AIResult {
  adjustedScore: number
  flags: string[]
  reasoning: string
}

export async function enhanceWithAI(
  wallet: string,
  graphResult: { baseScore: number; hopDistance: number; hitCount: number }
): Promise<AIResult> {
  const client = getClient()
  if (!client) {
    return { adjustedScore: graphResult.baseScore, flags: [], reasoning: "AI scoring unavailable" }
  }

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a blockchain compliance risk analyst for HashKey Chain.
Return ONLY valid JSON: { "adjustedScore": <integer 1-10>, "flags": <string[]>, "reasoning": <string max 200 chars> }
Adjust the base score by MAX 2 points. Do NOT override score 10 (sanctioned) or score 1 (known clean).
Flags: "rapid_movement", "clustering", "dormant_activation", "high_frequency", "contract_exploit", "mixer_exposure"`
        },
        {
          role: "user",
          content: `Wallet: ${wallet}\nBase score: ${graphResult.baseScore}/10\nHop distance: ${graphResult.hopDistance}\nHit count: ${graphResult.hitCount}`
        }
      ]
    })

    const parsed = JSON.parse(response.choices[0].message.content!)
    return {
      adjustedScore: Math.max(1, Math.min(10, parseInt(parsed.adjustedScore))),
      flags: parsed.flags || [],
      reasoning: (parsed.reasoning || "").slice(0, 200)
    }
  } catch {
    return { adjustedScore: graphResult.baseScore, flags: [], reasoning: "AI scoring unavailable" }
  }
}
