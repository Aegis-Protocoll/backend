import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)
const CACHE_TTL = parseInt(process.env.SCORE_CACHE_TTL || "3600")

export async function getCachedScore(wallet: string) {
  const rows = await sql`
    SELECT * FROM risk_scores
    WHERE wallet = ${wallet.toLowerCase()}
      AND updated_at > NOW() - INTERVAL '1 second' * ${CACHE_TTL}
  `
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    score: r.score as number,
    level: r.level as string,
    flags: (r.flags as string[]) || [],
    reasoning: r.reasoning as string,
    hopDistance: r.hop_distance as number,
    isCompliant: r.is_compliant as boolean,
    layer: r.layer as string,
    txHash: r.tx_hash as string | null,
    updatedAt: Math.floor(new Date(r.updated_at as string).getTime() / 1000)
  }
}

export async function upsertScore(
  wallet: string,
  score: number,
  level: string,
  flags: string[],
  reasoning: string,
  hopDistance: number,
  isCompliant: boolean,
  layer: string,
  txHash: string | null
) {
  const w = wallet.toLowerCase()
  await sql`
    INSERT INTO risk_scores (wallet, score, level, flags, reasoning, hop_distance, is_compliant, layer, tx_hash, updated_at)
    VALUES (${w}, ${score}, ${level}, ${flags}, ${reasoning}, ${hopDistance}, ${isCompliant}, ${layer}, ${txHash}, NOW())
    ON CONFLICT (wallet) DO UPDATE SET
      score = ${score}, level = ${level}, flags = ${flags}, reasoning = ${reasoning},
      hop_distance = ${hopDistance}, is_compliant = ${isCompliant}, layer = ${layer},
      tx_hash = ${txHash}, updated_at = NOW()
  `
  await sql`
    INSERT INTO score_history (wallet, score, level, flags, reasoning, hop_distance, layer, tx_hash)
    VALUES (${w}, ${score}, ${level}, ${flags}, ${reasoning}, ${hopDistance}, ${layer}, ${txHash})
  `
}

export async function getScoreHistory(wallet: string, limit = 20) {
  return sql`
    SELECT * FROM score_history
    WHERE wallet = ${wallet.toLowerCase()}
    ORDER BY scored_at DESC
    LIMIT ${limit}
  `
}
