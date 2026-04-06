# Aegis Protocol — Backend API

> 4-layer AI scoring pipeline with on-chain write and REST API for wallet risk management.

**Hackathon:** HashKey Chain Horizon 2026 | **Tracks:** AI + DeFi | **Chain:** HashKey Chain Testnet (133)

[Docs](https://aegisprotocol-1.gitbook.io/aegisprotocol) | [Landing](https://aegis-protocol-hsk.vercel.app) | [Demo](https://aegis-demo-hsk.vercel.app)

---

## Live API

```
https://aegis-api-hsk.vercel.app
```

---

## Technical Overview

The backend is a single Node.js/Express service that:

1. Receives wallet addresses via REST API
2. Runs a 4-layer scoring pipeline (Attribution → Sanctions → Graph → AI)
3. Writes the final score on-chain to `AegisRiskScore.sol` on HashKey Chain
4. Caches results in Neon PostgreSQL for fast reads and audit trail

### Why This Architecture

- **API-driven, no block listener** — wallets are scored on-demand, not per-block. This avoids gas waste and AI rate limits.
- **Chain as source of truth** — Neon is a read cache with TTL (default 1 hour). On miss, reads fall back to on-chain data.
- **Serverless-compatible** — runs on Vercel as a single serverless function via `@vercel/node`.

---

## 4-Layer Scoring Pipeline

This is the core AI contribution. Each layer serves a distinct purpose, and the pipeline short-circuits when an authoritative result is found.

```
Wallet → L1 Attribution → L2 Sanctions → L3 Graph → L4 AI → Final Score
              ↓ (clean)       ↓ (sanctioned)
           score=1, STOP    score=10, STOP
```

### Layer 1 — Attribution Override
Known clean addresses (exchanges, bridges, protocol contracts) are hardcoded. If matched, score = 1 and pipeline stops. This prevents false positives on infrastructure addresses.

### Layer 2 — Sanctions Screening
Checks against OFAC SDN list (Tornado Cash addresses). If matched, score = 10 (CRITICAL) and pipeline stops. Zero tolerance for sanctioned entities.

### Layer 3 — Graph Proximity Analysis
Queries on-chain transaction logs via `provider.getLogs()`:
- Scans last 2,000 blocks for direct interactions
- Performs 2-hop analysis (checks counterparties of counterparties)
- Computes hop distance to nearest malicious address

| Hop Distance | Base Score |
|---|---|
| 0 (is malicious) | 10 |
| 1 hop | 8 |
| 2 hops | 6 |
| 3 hops | 4 |
| 4 hops | 2 |
| 5+ hops | 1 |

Additional modifiers: hit count >= 3 adds +1, no exchange proximity adds +1.

### Layer 4 — AI Behavioral Enhancement
Sends wallet context to Groq (llama-3.3-70b-versatile) via OpenAI-compatible SDK:
- Input: wallet address, base score, hop distance, hit count
- Output: adjusted score (max ±2 from base), behavioral flags, reasoning
- Flags: `rapid_movement`, `clustering`, `dormant_activation`, `high_frequency`, `contract_exploit`, `mixer_exposure`
- Graceful fallback: if AI call fails, base score is returned unchanged

### Final Score Calculation

```
final = round(graph_score × 0.6 + ai_score × 0.4)
clamped to [1, 10]
```

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/risk/:wallet` | Read risk profile (Neon cache → chain fallback) |
| `POST` | `/v1/risk/analyze` | Run full pipeline → write chain + Neon |
| `POST` | `/v1/risk/payment` | Payment risk A→B (max score of both wallets) |
| `POST` | `/v1/risk/mock` | Write a specific score directly (demo/testing) |
| `GET` | `/v1/risk/:wallet/history` | Scoring audit trail from Neon |
| `GET` | `/health` | Service health check |

### Example Request/Response

```bash
curl https://aegis-api-hsk.vercel.app/v1/risk/0x2222222222222222222222222222222222222222
```

```json
{
  "wallet": "0x2222222222222222222222222222222222222222",
  "score": 8,
  "level": "HIGH",
  "flags": ["mixer_exposure", "rapid_movement"],
  "reasoning": "Direct mixer contact, rapid fund movement",
  "hopDistance": 1,
  "isCompliant": false,
  "txHash": "0x3b19e182...",
  "updatedAt": 1775387885
}
```

---

## Database Schema (Neon PostgreSQL)

Two tables:
- `risk_scores` — current score cache (upsert on wallet, TTL-based invalidation)
- `score_history` — append-only audit trail (every score ever computed)

Indexes on wallet address and timestamp for fast lookups.

---

## Project Structure

```
src/
├── index.ts              Entry point + Vercel export
├── api.ts                Express routes
├── writer.ts             Chain writes + Neon cache
├── db.ts                 Neon serverless PostgreSQL
├── db-schema.sql         Table definitions
├── seed-demo.ts          Seeds demo wallets on-chain + Neon
├── pipeline/
│   ├── index.ts          Orchestrator (4-layer sequence)
│   ├── layer1-attribution.ts
│   ├── layer2-sanctions.ts
│   ├── layer3-graph.ts
│   └── layer4-ai.ts
└── abi/
    └── AegisRiskScore.json
```

---

## Setup

```bash
npm install
cp .env.example .env
psql $DATABASE_URL -f src/db-schema.sql
npm run dev
```

## Deploy

```bash
vercel --prod
```

## Tech

Node.js | Express | TypeScript | ethers.js v6 | Groq API (llama-3.3-70b) | Neon PostgreSQL | Vercel Serverless
