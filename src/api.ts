import express from "express"
import cors from "cors"
import { ethers } from "ethers"
import { runScoringPipeline } from "./pipeline"
import { writeRiskScore, readRiskProfile, _getProvider } from "./writer"
import { getScoreHistory } from "./db"

export const app = express()
app.use(cors())
app.use(express.json())

app.get("/v1/risk/:wallet", async (req, res) => {
  try {
    if (!ethers.isAddress(req.params.wallet))
      return res.status(400).json({ error: "Invalid wallet address" })
    const profile = await readRiskProfile(req.params.wallet)
    res.json({
      wallet: req.params.wallet,
      ...profile,
      stale: Date.now() / 1000 - (profile.updatedAt || 0) > 86400
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post("/v1/risk/analyze", async (req, res) => {
  try {
    const { wallet } = req.body
    if (!wallet || !ethers.isAddress(wallet))
      return res.status(400).json({ error: "Valid wallet address required" })
    const result = await runScoringPipeline(wallet, _getProvider())
    const txHash = await writeRiskScore(
      wallet, result.score, result.flags, result.reasoning,
      result.hopDistance, result.level, result.layer
    )
    res.json({ wallet, ...result, txHash, status: "updated" })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post("/v1/risk/payment", async (req, res) => {
  try {
    const { from, to, amount } = req.body
    if (!from || !to || !ethers.isAddress(from) || !ethers.isAddress(to))
      return res.status(400).json({ error: "Valid from and to addresses required" })
    const [fromProfile, toProfile] = await Promise.all([readRiskProfile(from), readRiskProfile(to)])
    const maxScore = Math.max(fromProfile.score, toProfile.score)
    res.json({
      from: { wallet: from, score: fromProfile.score, level: fromProfile.level },
      to: { wallet: to, score: toProfile.score, level: toProfile.level },
      payment: { amount, risk: maxScore >= 7 ? "high" : maxScore >= 4 ? "medium" : "low", maxScore },
      recommendation: maxScore >= 7 ? "block" : maxScore >= 4 ? "flag" : "allow",
      flags: [...new Set([...fromProfile.flags, ...toProfile.flags])]
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get("/v1/risk/:wallet/history", async (req, res) => {
  try {
    if (!ethers.isAddress(req.params.wallet))
      return res.status(400).json({ error: "Invalid wallet address" })
    const history = await getScoreHistory(req.params.wallet)
    res.json({ wallet: req.params.wallet, history })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "aegis-backend", chain: "HashKey Chain Testnet (133)", db: "neon" })
})
