import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

// Read real OFAC TRON addresses
const trxOfac = JSON.parse(readFileSync("data/ofac/TRX.json", "utf8"));
const REAL_WALLETS = [
  trxOfac[0], // TA3rH2A7iHnm6pKH8gr9cK1EZnShnmZdFg (Cluster 1: 8 records)
  trxOfac[1], // TA82wQ77kb9DieW4C8q7C4KwMfnCzfziqN (Cluster 2: 7 records)
  trxOfac[2], // TASWbk6X1wiTku5TMmMQYqYFvshVEtfJy8 (Cluster 3: 6 records)
];

const CITIES = ["Chandigarh", "Ludhiana", "Mohali", "Panchkula"];

// Seedable pseudo-random generator for deterministic synthetic addresses
function createRng(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = createRng(20260814);
const B58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function syntheticTronAddr() {
  let res = "T";
  for (let i = 0; i < 33; i++) {
    res += B58_CHARS[Math.floor(rng() * B58_CHARS.length)];
  }
  return res;
}

function syntheticBtcAddr() {
  let res = "1";
  for (let i = 0; i < 33; i++) {
    res += B58_CHARS[Math.floor(rng() * B58_CHARS.length)];
  }
  return res;
}

const records = [];

// =============================================================
// Cluster 1 (8 records) -> Shared cashOutWallet: REAL_WALLETS[0]
// Target total: ₹41.2L (₹4,120,000)
// =============================================================
// Record 1 MUST be exactly: 2026-CHD-0417, 2026-08-14, ₹800020, Chandigarh
records.push({
  id: "2026-CHD-0417",
  date: "2026-08-14",
  city: "Chandigarh",
  amountInr: 800020,
  paidAs: "USDT-TRC20",
  paidTo: syntheticTronAddr(),
  cashOutWallet: REAL_WALLETS[0],
  notes: "Digital arrest extortion via fake police threat; funds converted to USDT and routed to fast cash-out wallet.",
});

// Remaining 7 records of Cluster 1 (sum = 3,319,980, total cluster = 4,120,000)
const cluster1OtherAmounts = [520000, 610000, 440000, 395000, 480000, 560000, 314980];
const cluster1Dates = ["2026-08-04", "2026-08-07", "2026-08-09", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-15"];
const cluster1Cities = ["Mohali", "Chandigarh", "Panchkula", "Ludhiana", "Chandigarh", "Mohali", "Panchkula"];
const cluster1Notes = [
  "Telegram part-time task scam promising daily ROI; funds layered into shared P2P off-ramp cluster.",
  "Fake investment scheme on fraudulent trading app; victim lured with simulated profits.",
  "Job recruitment fraud requiring advance security deposit in crypto.",
  "Loan approval fee scam directing victim to purchase USDT.",
  "Cryptocurrency arbitrage fraud promising guaranteed spread earnings.",
  "FedEx package impersonation scam demanding immediate clearance transfer.",
  "Online rating review task fraud with escalated deposit tiers.",
];

for (let i = 0; i < 7; i++) {
  const num = String(418 + i).padStart(4, "0");
  const cityCode = cluster1Cities[i].slice(0, 3).toUpperCase();
  records.push({
    id: `2026-${cityCode}-${num}`,
    date: cluster1Dates[i],
    city: cluster1Cities[i],
    amountInr: cluster1OtherAmounts[i],
    paidAs: "USDT-TRC20",
    paidTo: syntheticTronAddr(),
    cashOutWallet: REAL_WALLETS[0],
    notes: cluster1Notes[i],
  });
}

// =============================================================
// Cluster 2 (7 records) -> Shared cashOutWallet: REAL_WALLETS[1]
// Target total: ₹28.6L (₹2,860,000)
// =============================================================
const cluster2Amounts = [420000, 380000, 490000, 310000, 520000, 410000, 330000];
const cluster2Dates = ["2026-08-03", "2026-08-06", "2026-08-08", "2026-08-10", "2026-08-12", "2026-08-14", "2026-08-16"];
const cluster2Cities = ["Ludhiana", "Mohali", "Ludhiana", "Chandigarh", "Panchkula", "Ludhiana", "Mohali"];
const cluster2Notes = [
  "Fake stock market advisory group channeling funds into 2-hop layered mule infrastructure.",
  "Pre-IPO share allotment fraud on fake web portal.",
  "Institutional trading account scam with frozen withdrawal pretext.",
  "Commodity trading tip scam requiring crypto wallet transfer.",
  "Deepfake executive impersonation demanding urgent vendor settlement.",
  "High-yield forex trading bot scam with fabricated performance dashboard.",
  "Crypto mining pool deposit scam with locked principal.",
];

for (let i = 0; i < 7; i++) {
  const num = String(430 + i).padStart(4, "0");
  const cityCode = cluster2Cities[i].slice(0, 3).toUpperCase();
  records.push({
    id: `2026-${cityCode}-${num}`,
    date: cluster2Dates[i],
    city: cluster2Cities[i],
    amountInr: cluster2Amounts[i],
    paidAs: "USDT-TRC20",
    paidTo: syntheticTronAddr(),
    cashOutWallet: REAL_WALLETS[1],
    notes: cluster2Notes[i],
  });
}

// =============================================================
// Cluster 3 (6 records) -> Shared cashOutWallet: REAL_WALLETS[2]
// Cross-chain BTC -> TRON syndicate. Target total: ₹19.4L (₹1,940,000)
// =============================================================
const cluster3Amounts = [350000, 280000, 410000, 320000, 290000, 290000];
const cluster3Dates = ["2026-08-05", "2026-08-07", "2026-08-10", "2026-08-13", "2026-08-15", "2026-08-17"];
const cluster3Cities = ["Chandigarh", "Panchkula", "Mohali", "Chandigarh", "Ludhiana", "Panchkula"];
const cluster3PaidAs = ["BTC", "BTC", "BTC", "USDT-TRC20", "BTC", "USDT-TRC20"];
const cluster3Notes = [
  "Cross-chain ransomware payment converted from BTC into consolidated TRON cash-out.",
  "Blackmail extortion paid in Bitcoin, tracked hopping to TRC-20 off-ramp.",
  "Fake crypto recovery agent demanding upfront fee in Bitcoin.",
  "Cross-chain pig butchering investment scam hopping across chains.",
  "Phishing compromise of victim seed phrase; BTC liquidated to TRON.",
  "Tech support fraud coercing Bitcoin ATM deposit, settled to TRON.",
];

for (let i = 0; i < 6; i++) {
  const num = String(440 + i).padStart(4, "0");
  const cityCode = cluster3Cities[i].slice(0, 3).toUpperCase();
  const isBtc = cluster3PaidAs[i] === "BTC";
  records.push({
    id: `2026-${cityCode}-${num}`,
    date: cluster3Dates[i],
    city: cluster3Cities[i],
    amountInr: cluster3Amounts[i],
    paidAs: cluster3PaidAs[i],
    paidTo: isBtc ? syntheticBtcAddr() : syntheticTronAddr(),
    cashOutWallet: REAL_WALLETS[2],
    notes: cluster3Notes[i],
  });
}

// =============================================================
// Unique Non-Clustered Records (26 records) -> Unique synthetic cashOutWallet
// Total records = 21 + 26 = 47 records
// =============================================================
const uniqueAmounts = [
  45000, 78000, 112000, 145000, 189000, 210000, 235000, 260000, 295000, 320000,
  345000, 380000, 410000, 450000, 485000, 520000, 560000, 610000, 640000, 690000,
  720000, 765000, 810000, 850000, 895000, 940000
];

const uniqueNotes = [
  "Fake credit card limit upgrade phishing scam.",
  "Electricity bill disconnection threat fraud.",
  "Online gaming tournament registration fraud.",
  "E-commerce parcel customs duty impersonation scam.",
  "Matrimonial profile romance scam with hospital emergency pretext.",
  "Unauthorized remote access app fraud via fake banking helpline.",
  "Fake airline ticket refund helpline scam.",
  "Cryptocurrency trading bot subscription fraud.",
  "Fake work-from-home data entry job deposit fraud.",
  "Insurance policy bonus release fee scam.",
  "Pre-approved personal loan processing fee scam.",
  "Fake hotel booking voucher fraud.",
  "Lottery prize tax deduction scam.",
  "Fake franchise fee fraud for courier agency.",
  "Counterfeit digital currency investment scheme.",
  "Rental property advance token amount scam.",
  "SIM card KYC update phishing trap.",
  "Fake educational admission processing scam.",
  "Overseas job visa clearance fee fraud.",
  "Vehicle resale token advance scam on OLX.",
  "Government subsidy clearance fee fraud.",
  "Counterfeit gold coin investment scam.",
  "Fake social media influencer brand sponsorship advance.",
  "High-return real estate tokenization scam.",
  "Unregistered offshore crypto derivative trading loss fraud.",
  "Impersonation of customs officer demanding penalty payment.",
];

for (let i = 0; i < 26; i++) {
  const day = String(2 + (i % 26)).padStart(2, "0");
  const num = String(450 + i).padStart(4, "0");
  const city = CITIES[i % CITIES.length];
  const cityCode = city.slice(0, 3).toUpperCase();
  const isBtc = i % 7 === 0; // mostly USDT-TRC20 else BTC

  records.push({
    id: `2026-${cityCode}-${num}`,
    date: `2026-08-${day}`,
    city,
    amountInr: uniqueAmounts[i],
    paidAs: isBtc ? "BTC" : "USDT-TRC20",
    paidTo: isBtc ? syntheticBtcAddr() : syntheticTronAddr(),
    cashOutWallet: syntheticTronAddr(),
    notes: uniqueNotes[i],
  });
}

if (records.length !== 47) {
  throw new Error(`Expected exactly 47 records, got ${records.length}`);
}

// Cluster verification
const clusters = new Map();
for (const r of records) {
  clusters.set(r.cashOutWallet, (clusters.get(r.cashOutWallet) || 0) + 1);
}

const multiClusters = [];
let singleCount = 0;
for (const [w, count] of clusters.entries()) {
  if (count > 1) {
    multiClusters.push({ wallet: w, count });
  } else {
    singleCount++;
  }
}

multiClusters.sort((a, b) => b.count - a.count);

console.log(`=== Cluster Counts (Total Records: ${records.length}) ===`);
multiClusters.forEach((c, idx) => {
  console.log(`Cluster ${idx + 1} (${c.wallet}): ${c.count} records`);
});
console.log(`Single-wallet records: ${singleCount}`);

// Save to data/synthetic/complaints.json
const outputData = {
  synthetic: true,
  records,
};

const outputDir = path.join(process.cwd(), "data", "synthetic");
mkdirSync(outputDir, { recursive: true });

const filePath = path.join(outputDir, "complaints.json");
writeFileSync(filePath, JSON.stringify(outputData, null, 2) + "\n");
console.log(`\nWrote data/synthetic/complaints.json successfully.`);
