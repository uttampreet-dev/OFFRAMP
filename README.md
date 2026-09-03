# OFFRAMP — crypto flow intelligence

OFFRAMP follows stolen money across the seam where it stops being crypto and starts being cash. It is an investigation console for officers handling crypto-linked fraud: trace a wallet across Bitcoin, Ethereum and TRON, screen every address on the path against sanctions and community blacklists, match the cash-out to a bank credit, compose a freeze-request packet inside the withdrawal window, and hand over a hash-chained evidence pack with an STR draft and a Section 63 certificate.

Everything on screen is either live public chain data or clearly labelled synthetic demonstration data. OFFRAMP does not freeze funds, does not transmit anything to an exchange or bank, and never names a wallet's owner without a public source.

## Modules

| Module | What it does | Data |
|---|---|---|
| **Live Board** | Watched addresses re-evaluated against live chain state every 60 s: balance, activity, OFAC hit, known entity, community report. Activity feed from chain events and the audit log. Open freeze windows counting down. | live |
| **Cases** | Sequential case files opened on a seed wallet. Status, notes and every action taken from any module land on one audited timeline. | live · demonstration case marked synthetic |
| **Trace** | Breadth-first flow trace by hop, following the largest counterparties, stopping at known entities. Value-weighted flow graph, sanctions screening of every node, counterparties by value. | live: Blockstream, Etherscan, TronGrid |
| **Bridge** | Matches an on-chain cash-out to an INR bank credit by amount × exchange rate × time window. Reports a *candidate linkage* with a strength score and its rivals, never ownership. | live chain events or synthetic statement |
| **Red Flags** | Ten explainable detectors grounded in FATF virtual-asset red-flag indicators: rapid layering, structuring, P2P off-ramp, velocity spike, mixer contact, sanctions hit, bridge hop, dormant reactivation, peel chain, round-number transfers. Each fires with evidence lines and a heuristic confidence. | live |
| **Intercept** | Estimates the withdrawal window from the wallet's own inflow→outflow lag (three or more pairs, capped at 48 h), otherwise a stated 2-hour policy default. Composes and seals a freeze-request packet with SHA-256. | live · replay of the demonstration case |
| **Evidence** | Serialises every artefact canonically, hashes it, chains the hashes to a root, verifies the chain on demand. Exports a JSON bundle, an STR draft in FIU-IND layout, and a Section 63 (Bharatiya Sakshya Adhiniyam, 2023) certificate. Documents are drafts until signed. | case artefacts |
| **Syndicates** | Clustering of wallets and mule accounts into operator groups. Not built yet. | — |

## Data sources

| Source | Used for | Access |
|---|---|---|
| [Blockstream Esplora](https://blockstream.info/api/) | Bitcoin addresses and transactions | no key |
| [TronGrid](https://www.trongrid.io/) | TRON accounts and TRC-20 (USDT) transfers | free key raises limits |
| [Etherscan API v2](https://docs.etherscan.io/) | Ethereum transactions | free key required |
| [OFAC SDN digital-currency addresses](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses) | sanctions screening (`data/ofac`, synced 2026-08-31, 948 addresses) | public |
| [CryptoScamDB](https://cryptoscamdb.org/) | community-reported addresses (`data/scam`) — a report, not a finding | public |
| Blockchair, WalletExplorer, Etherscan and Tronscan labels; OFAC designations | known exchanges and mixers (`data/known-entities.json`) — every entry carries the URL that documents the label | public |

## What is synthetic

- The demonstration case `2026-CHD-0417`: its narrative, the cash-out wallet `TVd6jP2Lm7Kf3Qa9Rc1Xe5Hb8Nd4Wg0Lm7`, the seven on-chain events, and the bank statement `demo-case-4471.csv`.
- Everything under `data/synthetic` (statements, complaints). Each file says so.
- The Intercept replay clock, anchored 12 min 38 s after the demonstration trigger.

Everything else is read live from public chains at the moment you look at it, and cached on disk so a demo survives a bad network.

## What OFFRAMP does not do

- It does not freeze, seize or move funds. It prepares the request an authorised officer sends.
- It does not transmit packets or reports. Delivery states on screen are workflow status only.
- It does not attribute ownership. "Known exchange" means a public source documents the label; the source is one click away.
- It does not decide. Detector output is presumptive; a Bridge match is a candidate linkage by amount and timing.

## Running it

```bash
npm install
cp .env.local.example .env.local   # add free Etherscan and TronGrid keys
node scripts/sync-ofac.mjs         # refresh the sanctions lists
npm run dev
```

Open http://localhost:3000. Demo logins:

| Login | Password | Role |
|---|---|---|
| `investigator` | `golden-hour` | investigator |
| `compliance` | `fiu-ind` | compliance |
| `supervisor` | `sector-17` | supervisor |

Set `OFFRAMP_OFFLINE=1` to serve every chain lookup from the on-disk cache without touching the network.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, better-sqlite3 for users, cases, watch list, packets, packs and the audit log. Sessions are HMAC-signed cookies with scrypt-hashed passwords. Every write is audited under the officer's login.
