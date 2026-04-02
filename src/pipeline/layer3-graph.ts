import { ethers } from "ethers"

const MALICIOUS_ADDRESSES = new Set<string>([])
const REGULATED_EXCHANGES = new Set<string>([])

export interface GraphResult {
  baseScore: number
  hopDistance: number
  hitCount: number
  exchangeDistance: number
  flags: string[]
}

export async function analyzeGraph(
  wallet: string,
  provider: ethers.JsonRpcProvider
): Promise<GraphResult> {
  const flags: string[] = []
  let hopDistance = 99
  let hitCount = 0
  let exchangeDistance = 99

  try {
    const blockNumber = await provider.getBlockNumber()
    const logs = await provider.getLogs({
      fromBlock: Math.max(0, blockNumber - 2000),
      toBlock: blockNumber,
      topics: [null, ethers.zeroPadValue(wallet, 32)]
    })

    const directAddresses = [...new Set(logs.map(l => l.address.toLowerCase()))]

    for (const addr of directAddresses) {
      if (MALICIOUS_ADDRESSES.has(addr)) {
        hopDistance = Math.min(hopDistance, 1)
        hitCount++
        flags.push("direct_malicious_contact")
      }
      if (REGULATED_EXCHANGES.has(addr)) exchangeDistance = Math.min(exchangeDistance, 1)
    }

    if (hopDistance > 1) {
      for (const addr of directAddresses.slice(0, 3)) {
        const secondLogs = await provider.getLogs({
          fromBlock: Math.max(0, blockNumber - 2000),
          toBlock: blockNumber,
          topics: [null, ethers.zeroPadValue(addr, 32)]
        })
        for (const l of secondLogs) {
          const a = l.address.toLowerCase()
          if (MALICIOUS_ADDRESSES.has(a)) { hopDistance = Math.min(hopDistance, 2); hitCount++ }
          if (REGULATED_EXCHANGES.has(a)) exchangeDistance = Math.min(exchangeDistance, 2)
        }
      }
    }
  } catch (err) {
    console.error("Graph analysis error:", err)
  }

  let baseScore =
    hopDistance === 0 ? 10 :
    hopDistance === 1 ? 8 :
    hopDistance === 2 ? 6 :
    hopDistance === 3 ? 4 :
    hopDistance === 4 ? 2 : 1

  if (hitCount >= 3) baseScore = Math.min(10, baseScore + 1)
  if (exchangeDistance > 3 && baseScore > 1) {
    baseScore = Math.min(10, baseScore + 1)
    flags.push("exchange_distance")
  }

  return { baseScore, hopDistance, hitCount, exchangeDistance, flags }
}
