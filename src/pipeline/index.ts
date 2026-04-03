import { ethers } from "ethers"
import { checkAttribution } from "./layer1-attribution"
import { checkSanctions } from "./layer2-sanctions"
import { analyzeGraph } from "./layer3-graph"
import { enhanceWithAI } from "./layer4-ai"

export interface ScoreResult {
  score: number
  level: string
  flags: string[]
  reasoning: string
  hopDistance: number
  layer: string
}

export async function runScoringPipeline(
  wallet: string,
  provider: ethers.JsonRpcProvider
): Promise<ScoreResult> {
  const attribution = await checkAttribution(wallet)
  if (attribution.isKnownClean) {
    return {
      score: 1, level: "VERY_LOW",
      flags: ["known_clean"],
      reasoning: `Known clean address: ${attribution.label}`,
      hopDistance: 99, layer: "attribution_override"
    }
  }

  const sanctions = await checkSanctions(wallet)
  if (sanctions.isSanctioned) {
    return {
      score: 10, level: "CRITICAL",
      flags: ["sanctions", ...sanctions.lists],
      reasoning: `Address on sanctions list: ${sanctions.lists.join(", ")}`,
      hopDistance: 0, layer: "sanctions_screening"
    }
  }

  const graph = await analyzeGraph(wallet, provider)
  const ai = await enhanceWithAI(wallet, graph)

  const finalScore = Math.round((graph.baseScore * 0.6) + (ai.adjustedScore * 0.4))
  const clamped = Math.max(1, Math.min(10, finalScore))

  return {
    score: clamped,
    level: scoreToLevel(clamped),
    flags: [...graph.flags, ...ai.flags],
    reasoning: ai.reasoning,
    hopDistance: graph.hopDistance,
    layer: "full_pipeline"
  }
}

function scoreToLevel(score: number): string {
  if (score === 1) return "VERY_LOW"
  if (score <= 3) return "LOW"
  if (score <= 6) return "MEDIUM"
  if (score <= 9) return "HIGH"
  return "CRITICAL"
}
