const KNOWN_CLEAN: Record<string, string> = {
  // "0x...": "HashKey DEX",
  // "0x...": "HashKey Bridge",
}

export async function checkAttribution(wallet: string): Promise<{
  isKnownClean: boolean
  label: string
}> {
  const label = KNOWN_CLEAN[wallet.toLowerCase()]
  return { isKnownClean: !!label, label: label || "" }
}
