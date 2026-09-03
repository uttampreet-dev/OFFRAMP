// Pulls the public CryptoScamDB/blacklist dataset (urls.yaml on GitHub)
// and writes a normalised address list to data/scam/cryptoscamdb.json.
import { writeFileSync, mkdirSync } from "fs";

const URL =
  "https://raw.githubusercontent.com/CryptoScamDB/blacklist/master/data/urls.yaml";

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function looksLikeAddress(value) {
  if (!value || value.length < 20 || value.length > 128) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (/^[A-Z]{2,6}$/.test(value)) return false;
  return /^(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{24,33}|bc1[a-z0-9]{25,87}|T[1-9A-HJ-NP-Za-km-z]{33}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,33}|r[1-9A-HJ-NP-Za-km-z]{24,34})$/.test(
    value
  );
}

function parseYamlAddresses(yaml) {
  const out = [];
  const seen = new Set();
  const chunks = yaml.split(/^- /m);
  for (const chunk of chunks) {
    if (!chunk.startsWith("name:")) continue;
    const catM = chunk.match(/^\s*category:\s*(.+)$/m);
    const category = catM ? unquote(catM[1]) : "unknown";
    const addrIdx = chunk.search(/^\s*addresses:\s*$/m);
    if (addrIdx < 0) continue;
    const rest = chunk.slice(addrIdx);
    for (const line of rest.split("\n").slice(1)) {
      if (/^\s*(reporter|description|url|subcategory|name)\s*:/.test(line)) break;
      if (line.startsWith("- ")) break;
      const item = line.match(/^\s+-\s+(.+?)\s*$/);
      if (!item) continue;
      const address = unquote(item[1]);
      if (!looksLikeAddress(address)) continue;
      const key = address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ address, category, source: "cryptoscamdb" });
    }
  }
  return out;
}

const res = await fetch(URL);
if (!res.ok) {
  console.error(`CryptoScamDB blacklist fetch failed: HTTP ${res.status} for ${URL}`);
  process.exit(1);
}
const yaml = await res.text();
const list = parseYamlAddresses(yaml);

mkdirSync("data/scam", { recursive: true });
writeFileSync("data/scam/cryptoscamdb.json", JSON.stringify(list));
console.log(`synced ${list.length} cryptoscamdb addresses`);
