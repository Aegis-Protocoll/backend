import "dotenv/config"
import { app } from "./api"

const PORT = process.env.PORT || 3000

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log("Aegis Protocol Backend")
    console.log(`API: http://localhost:${PORT}`)
    console.log("Chain: HashKey Chain Testnet (ID: 133)")
    console.log("DB: Neon PostgreSQL (cache + audit)")
  })
}

export default app
