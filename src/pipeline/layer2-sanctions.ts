const SANCTIONED_ADDRESSES = new Set<string>([
  "0x7f268357a8c2552623316e2562d90e642bb538e5",
  "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
  "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
  "0xa160cdab225685da1d56aa342ad8841c3b53f291",
])

export async function checkSanctions(wallet: string): Promise<{
  isSanctioned: boolean
  lists: string[]
}> {
  const lists: string[] = []
  if (SANCTIONED_ADDRESSES.has(wallet.toLowerCase())) lists.push("OFAC_SDN")
  return { isSanctioned: lists.length > 0, lists }
}
