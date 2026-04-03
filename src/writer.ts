import { ethers } from "ethers"
import AegisABI from "./abi/AegisRiskScore.json"
import { upsertScore, getCachedScore } from "./db"

let provider: ethers.JsonRpcProvider
let contract: ethers.Contract | null = null

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) provider = new ethers.JsonRpcProvider(process.env.RPC_URL!)
  return provider
}

function getContract(): ethers.Contract {
  if (contract) return contract
  if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === "0x")
    throw new Error("PRIVATE_KEY not configured")
  if (!process.env.AEGIS_CONTRACT_ADDRESS || process.env.AEGIS_CONTRACT_ADDRESS === "0x")
    throw new Error("AEGIS_CONTRACT_ADDRESS not configured")
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, getProvider())
  contract = new ethers.Contract(process.env.AEGIS_CONTRACT_ADDRESS, AegisABI, signer)
  return contract
}

export async function writeRiskScore(
  wallet: string,
  score: number,
  flags: string[],
  reasoning: string,
  hopDistance: number,
  level: string,
  layer: string
): Promise<string> {
  const c = getContract()
  const flagsBytes32: string[] = flags.slice(0, 4).map(f =>
    ethers.encodeBytes32String(f.slice(0, 31))
  )
  while (flagsBytes32.length < 4) flagsBytes32.push(ethers.ZeroHash)

  const reasoningBytes32 = ethers.encodeBytes32String(reasoning.slice(0, 31))

  const tx = await c.updateRiskScore(wallet, score, flagsBytes32, reasoningBytes32, hopDistance)
  await tx.wait()
  console.log(`✅ Score written | wallet=${wallet} score=${score} hops=${hopDistance} tx=${tx.hash}`)

  const isCompliant = score <= 6
  await upsertScore(wallet, score, level, flags, reasoning, hopDistance, isCompliant, layer, tx.hash)

  return tx.hash
}

export async function readRiskProfile(wallet: string) {
  const cached = await getCachedScore(wallet)
  if (cached) return cached

  try {
    const c = getContract()
    const p = await c.getRiskProfile(wallet)
    const levels = ["UNKNOWN", "VERY_LOW", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    return {
      score: Number(p.score),
      level: levels[Number(p.level)] || "UNKNOWN",
      isCompliant: p.isCompliant,
      flags: p.flags.map((f: string) => ethers.decodeBytes32String(f)).filter((f: string) => f !== ""),
      reasoning: ethers.decodeBytes32String(p.reasoning),
      hopDistance: Number(p.hopDistance),
      updatedAt: Number(p.updatedAt),
      txHash: null,
      layer: "chain_read"
    }
  } catch {
    return {
      score: 0, level: "UNKNOWN", isCompliant: true, flags: [],
      reasoning: "", hopDistance: 99, updatedAt: 0, txHash: null, layer: "none"
    }
  }
}

export { getProvider as _getProvider }
