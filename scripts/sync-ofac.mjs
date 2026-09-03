// Pulls the OFAC SDN digital-currency address lists (auto-updated nightly by
// github.com/0xB10C/ofac-sanctioned-digital-currency-addresses) into data/ofac/.
import { writeFileSync, mkdirSync } from "fs";

const BASE = "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists";
const ASSETS = ["XBT", "ETH", "TRX", "USDT"];

mkdirSync("data/ofac", { recursive: true });
let total = 0;
for (const asset of ASSETS) {
  try {
    const res = await fetch(`${BASE}/sanctioned_addresses_${asset}.json`);
    if (!res.ok) { console.log(`  ${asset}: not available (${res.status})`); continue; }
    const list = await res.json();
    writeFileSync(`data/ofac/${asset}.json`, JSON.stringify(list));
    console.log(`  ${asset}: ${list.length} addresses`);
    total += list.length;
  } catch (e) {
    console.log(`  ${asset}: failed — ${e.message}`);
  }
}
writeFileSync("data/ofac/meta.json", JSON.stringify({ syncedAt: new Date().toISOString(), total }));
console.log(`synced ${total} sanctioned addresses`);
