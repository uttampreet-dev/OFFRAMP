import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "data", "synthetic", "statements");
mkdirSync(OUTPUT_DIR, { recursive: true });

function formatCsv(rows) {
  const header = "date,time,narration,ref,debit,credit,balance,channel";
  const lines = [header];
  for (const r of rows) {
    const debitStr = r.debit !== undefined && r.debit !== null && r.debit !== "" ? String(r.debit) : "";
    const creditStr = r.credit !== undefined && r.credit !== null && r.credit !== "" ? String(r.credit) : "";
    const balanceStr = String(r.balance);
    lines.push(`${r.date},${r.time},${r.narration},${r.ref},${debitStr},${creditStr},${balanceStr},${r.channel}`);
  }
  return lines.join("\n") + "\n";
}

function calculateBalances(initialBalance, rows) {
  // Sort chronologically by date and time
  rows.sort((a, b) => {
    const dtA = `${a.date}T${a.time}`;
    const dtB = `${b.date}T${b.time}`;
    return dtA.localeCompare(dtB);
  });

  let curBal = initialBalance;
  for (const r of rows) {
    const c = Number(r.credit || 0);
    const d = Number(r.debit || 0);
    curBal = Math.round((curBal + c - d) * 100) / 100;
    if (curBal < 0) {
      throw new Error(`Negative balance detected on ${r.date} ${r.time}: ${curBal}`);
    }
    r.balance = curBal;
  }
  return rows;
}

// -------------------------------------------------------------
// Statement 1: demo-case-4471.csv
// -------------------------------------------------------------
const stmt1Mandatory = [
  { date: "2026-08-14", time: "11:31:07", narration: "UPI/collect/…4471", ref: "4471", credit: 42000, channel: "UPI" },
  { date: "2026-08-14", time: "11:38:52", narration: "IMPS/P2P/ref 88120", ref: "88120", credit: 115000, channel: "IMPS" },
  { date: "2026-08-14", time: "11:49:20", narration: "IMPS/P2P/ref 88147", ref: "88147", credit: 798180, channel: "IMPS" },
  { date: "2026-08-14", time: "11:56:44", narration: "UPI/collect/…9903", ref: "9903", credit: 64500, channel: "UPI" },
  { date: "2026-08-14", time: "12:04:11", narration: "NEFT/OUT/…2210", ref: "2210", debit: 690000, channel: "NEFT" },
  { date: "2026-08-14", time: "12:11:38", narration: "ATM WDL SEC-22 CHD", ref: "ATM8812", debit: 100000, channel: "ATM" },
];

const stmt1Noise = [
  // 10 Aug 2026
  { date: "2026-08-10", time: "08:14:22", narration: "UPI/P2M/CHAI-POINT/622301928311", ref: "622301928311", debit: 80, channel: "UPI" },
  { date: "2026-08-10", time: "09:30:15", narration: "IMPS/RENT-AUG26/ref 91024", ref: "91024", debit: 25000, channel: "IMPS" },
  { date: "2026-08-10", time: "13:20:44", narration: "UPI/P2M/SWIGGY/622312039182", ref: "622312039182", debit: 340, channel: "UPI" },
  { date: "2026-08-10", time: "17:45:10", narration: "UPI/REV/CASHBACK/622319283019", ref: "622319283019", credit: 50, channel: "UPI" },
  { date: "2026-08-10", time: "20:10:05", narration: "UPI/P2M/BLINKIT/622320192831", ref: "622320192831", debit: 465, channel: "UPI" },

  // 11 Aug 2026
  { date: "2026-08-11", time: "07:55:18", narration: "UPI/P2M/MOTHER-DAIRY/622401928301", ref: "622401928301", debit: 72, channel: "UPI" },
  { date: "2026-08-11", time: "10:18:33", narration: "BBPS/AIRTEL-PREPAID/882391028301", ref: "882391028301", debit: 749, channel: "BBPS" },
  { date: "2026-08-11", time: "12:40:50", narration: "UPI/P2M/ZEPTO/622412938102", ref: "622412938102", debit: 220, channel: "UPI" },
  { date: "2026-08-11", time: "15:10:12", narration: "UPI/REFUND/IRCTC/622415928391", ref: "622415928391", credit: 860, channel: "UPI" },
  { date: "2026-08-11", time: "19:25:40", narration: "UPI/P2M/HPCL-PETROL/622419283019", ref: "622419283019", debit: 1500, channel: "UPI" },
  { date: "2026-08-11", time: "21:30:15", narration: "UPI/P2M/CHAAYOS/622421391820", ref: "622421391820", debit: 195, channel: "UPI" },

  // 12 Aug 2026
  { date: "2026-08-12", time: "08:30:00", narration: "UPI/P2M/APOLLO-PHARM/622508391820", ref: "622508391820", debit: 540, channel: "UPI" },
  { date: "2026-08-12", time: "11:15:22", narration: "BBPS/PSPCL-POWER/771203918203", ref: "771203918203", debit: 3450, channel: "BBPS" },
  { date: "2026-08-12", time: "14:05:39", narration: "UPI/P2M/SWIGGY/622514059182", ref: "622514059182", debit: 410, channel: "UPI" },
  { date: "2026-08-12", time: "16:50:11", narration: "UPI/REV/MERCHANT-STMT/622516501928", ref: "622516501928", credit: 1200, channel: "UPI" },
  { date: "2026-08-12", time: "18:22:45", narration: "UPI/P2M/DMART/622518229182", ref: "622518229182", debit: 2180, channel: "UPI" },
  { date: "2026-08-12", time: "22:15:00", narration: "UPI/P2M/NETFLIX-SUBS/622522159182", ref: "622522159182", debit: 649, channel: "UPI" },

  // 13 Aug 2026
  { date: "2026-08-13", time: "09:12:10", narration: "UPI/P2M/METRO-TICKET/622609129182", ref: "622609129182", debit: 60, channel: "UPI" },
  { date: "2026-08-13", time: "12:35:18", narration: "UPI/P2M/ZEPTO/622612359182", ref: "622612359182", debit: 315, channel: "UPI" },
  { date: "2026-08-13", time: "15:45:00", narration: "UPI/CR/ONLINE-REFUND/622615459182", ref: "622615459182", credit: 450, channel: "UPI" },
  { date: "2026-08-13", time: "17:10:22", narration: "UPI/P2M/CHAAYOS/622617109182", ref: "622617109182", debit: 160, channel: "UPI" },
  { date: "2026-08-13", time: "19:40:55", narration: "UPI/P2M/BLINKIT/622619409182", ref: "622619409182", debit: 620, channel: "UPI" },
  { date: "2026-08-13", time: "21:18:30", narration: "UPI/P2M/SWIGGY/622621189182", ref: "622621189182", debit: 520, channel: "UPI" },

  // 14 Aug 2026 (outside the burst hours)
  { date: "2026-08-14", time: "08:10:14", narration: "UPI/P2M/CHAI-POINT/622708109182", ref: "622708109182", debit: 90, channel: "UPI" },
  { date: "2026-08-14", time: "09:45:20", narration: "UPI/P2M/MOTHER-DAIRY/622709459182", ref: "622709459182", debit: 84, channel: "UPI" },
  { date: "2026-08-14", time: "14:30:15", narration: "UPI/P2M/SWIGGY/622714309182", ref: "622714309182", debit: 480, channel: "UPI" },
  { date: "2026-08-14", time: "18:05:40", narration: "UPI/P2M/IOCL-PETROL/622718059182", ref: "622718059182", debit: 2000, channel: "UPI" },
  { date: "2026-08-14", time: "20:50:12", narration: "UPI/P2M/ZEPTO/622720509182", ref: "622720509182", debit: 395, channel: "UPI" },

  // 15 Aug 2026
  { date: "2026-08-15", time: "09:20:00", narration: "UPI/P2M/SWEET-SHOP/622809209182", ref: "622809209182", debit: 450, channel: "UPI" },
  { date: "2026-08-15", time: "11:35:40", narration: "UPI/P2M/BOOKMYSHOW/622811359182", ref: "622811359182", debit: 780, channel: "UPI" },
  { date: "2026-08-15", time: "13:50:15", narration: "UPI/CR/CASHBACK-REWARD/622813509182", ref: "622813509182", credit: 150, channel: "UPI" },
  { date: "2026-08-15", time: "15:15:30", narration: "UPI/P2M/DOMINOS/622815159182", ref: "622815159182", debit: 890, channel: "UPI" },
  { date: "2026-08-15", time: "17:40:22", narration: "UPI/P2M/RELIANCE-FRESH/622817409182", ref: "622817409182", debit: 1450, channel: "UPI" },
  { date: "2026-08-15", time: "20:10:05", narration: "UPI/P2M/BLINKIT/622820109182", ref: "622820109182", debit: 310, channel: "UPI" },

  // 16 Aug 2026
  { date: "2026-08-16", time: "08:45:10", narration: "UPI/P2M/CHAI-POINT/622908459182", ref: "622908459182", debit: 110, channel: "UPI" },
  { date: "2026-08-16", time: "11:00:25", narration: "UPI/P2M/BIGBASKET/622911009182", ref: "622911009182", debit: 1820, channel: "UPI" },
  { date: "2026-08-16", time: "14:15:40", narration: "UPI/P2M/SWIGGY/622914159182", ref: "622914159182", debit: 420, channel: "UPI" },
  { date: "2026-08-16", time: "16:30:15", narration: "UPI/REV/PAYTM-CASHBACK/622916309182", ref: "622916309182", credit: 75, channel: "UPI" },
  { date: "2026-08-16", time: "19:05:50", narration: "UPI/P2M/APOLLO-PHARM/622919059182", ref: "622919059182", debit: 340, channel: "UPI" },
  { date: "2026-08-16", time: "21:40:12", narration: "UPI/P2M/ZEPTO/622921409182", ref: "622921409182", debit: 275, channel: "UPI" },
];

if (stmt1Noise.length !== 40) {
  throw new Error(`Statement 1 must have exactly 40 noise rows, got ${stmt1Noise.length}`);
}

const stmt1All = calculateBalances(185000, [...stmt1Mandatory, ...stmt1Noise]);
writeFileSync(path.join(OUTPUT_DIR, "demo-case-4471.csv"), formatCsv(stmt1All));

// -------------------------------------------------------------
// Statement 2: mule-8821.csv (account …8821)
// -------------------------------------------------------------
const stmt2Rows = [
  // Starting balance: 35,000
  { date: "2026-08-10", time: "11:15:00", narration: "UPI/P2M/IOCL-PETROL/622311150192", ref: "622311150192", debit: 1200, channel: "UPI" },
  { date: "2026-08-11", time: "09:40:22", narration: "UPI/P2M/ZEPTO/622409402201", ref: "622409402201", debit: 350, channel: "UPI" },
  { date: "2026-08-11", time: "18:20:10", narration: "UPI/P2M/SWIGGY/622418201019", ref: "622418201019", debit: 420, channel: "UPI" },

  // IMPS/P2P Credit 1
  { date: "2026-08-12", time: "14:10:25", narration: "IMPS/P2P/ref 88120", ref: "88120", credit: 115000, channel: "IMPS" },
  { date: "2026-08-12", time: "14:45:00", narration: "NEFT/OUT/…3391", ref: "3391", debit: 110000, channel: "NEFT" },

  { date: "2026-08-13", time: "10:05:15", narration: "UPI/P2M/CHAI-POINT/622610051520", ref: "622610051520", debit: 120, channel: "UPI" },
  { date: "2026-08-13", time: "16:30:40", narration: "UPI/P2M/BLINKIT/622616304019", ref: "622616304019", debit: 580, channel: "UPI" },

  // IMPS/P2P Credit 2
  { date: "2026-08-14", time: "15:20:45", narration: "IMPS/P2P/ref 77312", ref: "77312", credit: 185000, channel: "IMPS" },
  { date: "2026-08-14", time: "16:15:30", narration: "ATM WDL SEC-35 CHD", ref: "ATM3501", debit: 100000, channel: "ATM" },
  { date: "2026-08-14", time: "16:22:15", narration: "ATM WDL SEC-35 CHD", ref: "ATM3502", debit: 80000, channel: "ATM" },

  { date: "2026-08-15", time: "09:30:10", narration: "UPI/P2M/MOTHER-DAIRY/622809301019", ref: "622809301019", debit: 95, channel: "UPI" },
  { date: "2026-08-15", time: "13:10:45", narration: "UPI/P2M/DOMINOS/622813104520", ref: "622813104520", debit: 650, channel: "UPI" },

  // IMPS/P2P Credit 3
  { date: "2026-08-15", time: "16:45:12", narration: "IMPS/P2P/ref 91044", ref: "91044", credit: 95000, channel: "IMPS" },
  { date: "2026-08-15", time: "17:30:00", narration: "UPI/OUT/…5512", ref: "5512", debit: 90000, channel: "UPI" },

  { date: "2026-08-16", time: "11:20:00", narration: "UPI/P2M/DMART/622911200019", ref: "622911200019", debit: 1420, channel: "UPI" },
  { date: "2026-08-16", time: "18:40:15", narration: "UPI/P2M/APOLLO-PHARM/622918401520", ref: "622918401520", debit: 380, channel: "UPI" },
];

const stmt2All = calculateBalances(35000, stmt2Rows);
writeFileSync(path.join(OUTPUT_DIR, "mule-8821.csv"), formatCsv(stmt2All));

// -------------------------------------------------------------
// Statement 3: mule-0456.csv (account …0456)
// -------------------------------------------------------------
const stmt3Rows = [
  // Starting balance: 42,000
  { date: "2026-08-10", time: "10:25:10", narration: "UPI/P2M/BIGBASKET/622310251019", ref: "622310251019", debit: 1850, channel: "UPI" },
  { date: "2026-08-11", time: "08:15:40", narration: "UPI/P2M/CHAI-POINT/622408154019", ref: "622408154019", debit: 110, channel: "UPI" },
  { date: "2026-08-11", time: "14:50:30", narration: "UPI/P2M/SWIGGY/622414503019", ref: "622414503019", debit: 540, channel: "UPI" },

  // IMPS/P2P Credit 1
  { date: "2026-08-12", time: "11:05:18", narration: "IMPS/P2P/ref 66109", ref: "66109", credit: 240000, channel: "IMPS" },
  { date: "2026-08-12", time: "12:15:00", narration: "NEFT/OUT/…8812", ref: "8812", debit: 235000, channel: "NEFT" },

  { date: "2026-08-13", time: "11:40:20", narration: "UPI/P2M/HPCL-PETROL/622611402019", ref: "622611402019", debit: 2000, channel: "UPI" },
  { date: "2026-08-13", time: "19:15:10", narration: "UPI/P2M/ZEPTO/622619151019", ref: "622619151019", debit: 420, channel: "UPI" },

  // IMPS/P2P Credit 2
  { date: "2026-08-14", time: "11:49:20", narration: "IMPS/P2P/ref 88147", ref: "88147", credit: 798180, channel: "IMPS" },
  { date: "2026-08-14", time: "12:30:00", narration: "NEFT/OUT/…6619", ref: "6619", debit: 750000, channel: "NEFT" },
  { date: "2026-08-14", time: "13:10:00", narration: "ATM WDL SEC-17 CHD", ref: "ATM1701", debit: 40000, channel: "ATM" },

  { date: "2026-08-15", time: "09:05:30", narration: "UPI/P2M/BLINKIT/622809053019", ref: "622809053019", debit: 310, channel: "UPI" },

  // IMPS/P2P Credit 3
  { date: "2026-08-15", time: "16:35:40", narration: "IMPS/P2P/ref 72418", ref: "72418", credit: 175000, channel: "IMPS" },
  { date: "2026-08-15", time: "17:15:00", narration: "RTGS/OUT/…9921", ref: "9921", debit: 170000, channel: "RTGS" },

  { date: "2026-08-16", time: "10:30:15", narration: "UPI/P2M/CHAAYOS/622910301519", ref: "622910301519", debit: 180, channel: "UPI" },
  { date: "2026-08-16", time: "15:45:20", narration: "UPI/P2M/RELIANCE-FRESH/622915452019", ref: "622915452019", debit: 1120, channel: "UPI" },
];

const stmt3All = calculateBalances(42000, stmt3Rows);
writeFileSync(path.join(OUTPUT_DIR, "mule-0456.csv"), formatCsv(stmt3All));

// -------------------------------------------------------------
// Statement 4: mule-7719.csv (account …7719)
// -------------------------------------------------------------
const stmt4Rows = [
  // Starting balance: 28,000
  { date: "2026-08-10", time: "08:50:12", narration: "UPI/P2M/MOTHER-DAIRY/622308501219", ref: "622308501219", debit: 65, channel: "UPI" },
  { date: "2026-08-10", time: "13:30:45", narration: "UPI/P2M/SWIGGY/622313304519", ref: "622313304519", debit: 380, channel: "UPI" },

  // IMPS/P2P Credit 1
  { date: "2026-08-11", time: "10:12:40", narration: "IMPS/P2P/ref 55102", ref: "55102", credit: 130000, channel: "IMPS" },
  { date: "2026-08-11", time: "11:30:00", narration: "IMPS/OUT/…1102", ref: "1102", debit: 125000, channel: "IMPS" },

  { date: "2026-08-12", time: "09:15:30", narration: "UPI/P2M/CHAI-POINT/622509153019", ref: "622509153019", debit: 85, channel: "UPI" },
  { date: "2026-08-12", time: "17:40:10", narration: "UPI/P2M/ZEPTO/622517401019", ref: "622517401019", debit: 290, channel: "UPI" },

  // IMPS/P2P Credit 2
  { date: "2026-08-13", time: "16:40:15", narration: "IMPS/P2P/ref 81923", ref: "81923", credit: 220000, channel: "IMPS" },
  { date: "2026-08-13", time: "17:15:00", narration: "ATM WDL SEC-43 CHD", ref: "ATM4301", debit: 100000, channel: "ATM" },
  { date: "2026-08-13", time: "17:22:00", narration: "ATM WDL SEC-43 CHD", ref: "ATM4302", debit: 100000, channel: "ATM" },

  { date: "2026-08-14", time: "10:45:00", narration: "UPI/P2M/IOCL-PETROL/622710450019", ref: "622710450019", debit: 1500, channel: "UPI" },
  { date: "2026-08-14", time: "19:20:30", narration: "UPI/P2M/BLINKIT/622719203019", ref: "622719203019", debit: 480, channel: "UPI" },

  // IMPS/P2P Credit 3
  { date: "2026-08-15", time: "14:05:55", narration: "IMPS/P2P/ref 99031", ref: "99031", credit: 145000, channel: "IMPS" },
  { date: "2026-08-15", time: "15:00:00", narration: "NEFT/OUT/…4412", ref: "4412", debit: 140000, channel: "NEFT" },

  { date: "2026-08-16", time: "09:30:15", narration: "UPI/P2M/APOLLO-PHARM/622909301519", ref: "622909301519", debit: 320, channel: "UPI" },
  { date: "2026-08-16", time: "14:10:40", narration: "UPI/P2M/SWIGGY/622914104019", ref: "622914104019", debit: 440, channel: "UPI" },
  { date: "2026-08-16", time: "20:05:10", narration: "UPI/P2M/ZEPTO/622920051019", ref: "622920051019", debit: 350, channel: "UPI" },
];

const stmt4All = calculateBalances(28000, stmt4Rows);
writeFileSync(path.join(OUTPUT_DIR, "mule-7719.csv"), formatCsv(stmt4All));

console.log("Successfully generated 4 synthetic bank statements:");
console.log(`- demo-case-4471.csv: ${stmt1All.length} rows`);
console.log(`- mule-8821.csv: ${stmt2All.length} rows`);
console.log(`- mule-0456.csv: ${stmt3All.length} rows`);
console.log(`- mule-7719.csv: ${stmt4All.length} rows`);
