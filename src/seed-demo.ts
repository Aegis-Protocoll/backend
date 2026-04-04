import "dotenv/config"
import { ethers } from "ethers"
import AegisABI from "./abi/AegisRiskScore.json"

async function seed() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
  const contract = new ethers.Contract(process.env.AEGIS_CONTRACT_ADDRESS!, AegisABI, signer)

  const toBytes32 = (s: string) => ethers.encodeBytes32String(s.slice(0, 31))
  const emptyFlags: string[] = [ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash]

  // Risky wallet — score 8, HIGH, non-compliant
  console.log("Seeding risky wallet (0x2222...2222) score=8 HIGH...")
  const riskyFlags = [toBytes32("mixer_exposure"), toBytes32("rapid_movement"), ethers.ZeroHash, ethers.ZeroHash]
  const tx1 = await contract.updateRiskScore(
    "0x2222222222222222222222222222222222222222",
    8, riskyFlags, toBytes32("Direct mixer contact"), 1
  )
  await tx1.wait()
  console.log("  tx:", tx1.hash)

  // Clean wallet — score 2, LOW, compliant
  console.log("Seeding clean wallet (0x1111...1111) score=2 LOW...")
  const tx2 = await contract.updateRiskScore(
    "0x1111111111111111111111111111111111111111",
    2, emptyFlags, toBytes32("Low risk, far from threats"), 4
  )
  await tx2.wait()
  console.log("  tx:", tx2.hash)

  // Verify
  console.log("\nVerifying...")
  const s1 = await contract.getScore("0x2222222222222222222222222222222222222222")
  const s2 = await contract.getScore("0x1111111111111111111111111111111111111111")
  console.log("Risky wallet score:", Number(s1))
  console.log("Clean wallet score:", Number(s2))

  // Also update Neon cache
  const { neon } = require("@neondatabase/serverless")
  const sql = neon(process.env.DATABASE_URL!)

  await sql`
    INSERT INTO risk_scores (wallet, score, level, flags, reasoning, hop_distance, is_compliant, layer, tx_hash, updated_at)
    VALUES ('0x2222222222222222222222222222222222222222', 8, 'HIGH', ${'{"mixer_exposure","rapid_movement"}'}::text[], 'Direct mixer contact, rapid fund movement', 1, false, 'demo_seed', ${tx1.hash}, NOW())
    ON CONFLICT (wallet) DO UPDATE SET
      score = 8, level = 'HIGH', flags = ${'{"mixer_exposure","rapid_movement"}'}::text[], reasoning = 'Direct mixer contact, rapid fund movement',
      hop_distance = 1, is_compliant = false, layer = 'demo_seed', tx_hash = ${tx1.hash}, updated_at = NOW()
  `
  await sql`
    INSERT INTO risk_scores (wallet, score, level, flags, reasoning, hop_distance, is_compliant, layer, tx_hash, updated_at)
    VALUES ('0x1111111111111111111111111111111111111111', 2, 'LOW', '{}', 'Low risk wallet, far from any known threats', 4, true, 'demo_seed', ${tx2.hash}, NOW())
    ON CONFLICT (wallet) DO UPDATE SET
      score = 2, level = 'LOW', flags = '{}', reasoning = 'Low risk wallet, far from any known threats',
      hop_distance = 4, is_compliant = true, layer = 'demo_seed', tx_hash = ${tx2.hash}, updated_at = NOW()
  `

  console.log("Neon cache updated")
  console.log("\n✅ Demo wallets seeded")
}

seed().catch(e => { console.error(e); process.exit(1) })
