# OFFRAMP — crypto flow intelligence

OFFRAMP follows stolen money across the seam where it stops being crypto and starts being cash. It is an investigation console for officers handling crypto-linked fraud: trace a wallet across Bitcoin, Ethereum and TRON, screen every address on the path against sanctions and community blacklists, match the cash-out to a bank credit, compose a freeze-request packet inside the withdrawal window, and hand over a hash-chained evidence pack with an STR draft and a Section 63 certificate.

Everything on screen is either live public chain data or clearly labelled synthetic demonstration data. OFFRAMP does not freeze funds, does not transmit anything to an exchange or bank, and never names a wallet's owner without a public source.

## Modules

| Module | What it does | Data |
|---|---|---|
| **Live Board** | Watched addresses re-evaluated against live chain state every 60 s: balance, activity, OFAC hit, known entity, community report. Activity feed from chain events and the audit log. Open freeze windows counting down. Alerts raised once per event: outflow from a watched address, contact with an OFAC-listed counterparty, activity on a reported address, abnormal transaction velocity, a window under 15 minutes. | live |
| **Cases** | Sequential case files opened on a seed wallet. Status, notes and every action taken from any module land on one audited timeline. One search across everything the console holds: case ids, wallets, transaction hashes, account numbers, complaints, entities, packets, packs and the audit log. | live · demonstration case marked synthetic |
| **Trace** | Breadth-first flow trace by hop, following the largest counterparties, stopping at known entities. Value-weighted flow graph, sanctions and community-report screening of every node, counterparties by value, activity-over-time chart. Paste a transaction hash instead of an address to open the transaction with both sides screened. On Bitcoin, a co-spend cluster (common-input-ownership heuristic, Meiklejohn et al. 2013) lists addresses that signed inputs together with the seed. | live: Blockstream, Etherscan, TronGrid |
| **Bridge** | Matches an on-chain cash-out to an INR bank credit by amount × exchange rate × time window. Reports a *candidate linkage* with a strength score and its rivals, never ownership. | live chain events or synthetic statement |
| **Red Flags** | Ten explainable detectors grounded in FATF virtual-asset red-flag indicators: rapid layering, structuring, P2P off-ramp, velocity spike, mixer contact, sanctions hit, bridge hop, dormant reactivation, peel chain, round-number transfers. Each fires with evidence lines and a heuristic confidence. | live |
| **Intercept** | Estimates the withdrawal window from the wallet's own inflow→outflow lag (three or more pairs, capped at 48 h), otherwise a stated 2-hour policy default. Composes and seals a freeze-request packet with SHA-256. A supervisor signs the sealed packet off as a separate audited step. | live · replay of the demonstration case |
| **Evidence** | Serialises every artefact canonically, hashes it, chains the hashes to a root, verifies the chain on demand. Exports a JSON bundle, an STR draft in FIU-IND layout, and a Section 63 (Bharatiya Sakshya Adhiniyam, 2023) certificate. Documents are drafts until signed. | case artefacts |
| **Access** | Your account (password change, active sessions, sign out everywhere) and, for a supervisor, account provisioning, roles, disable and reset, plus the access log. | live |
| **Syndicates** | Groups complaints whose money reached the same cash-out wallet, joined transitively, into operator groups: loss, tempo, cities, rails, wallets with screening and hand-offs. | synthetic complaints, labelled |

## Against the brief

| Expected feature | Where it is |
|---|---|
| Multi-source data collection | three block explorers, OFAC SDN, CryptoScamDB, sourced entity labels, bank statement CSV, synthetic complaints — all through one adapter layer with a disk cache |
| Intelligent entity correlation | Bridge (wallet ↔ bank credit), Syndicates (complaints ↔ cash-out wallets), co-spend clustering on Bitcoin, known-entity labels with sources, FATF-grounded detectors |
| Suspicious transaction detection | ten detectors: rapid layering, structuring, P2P off-ramp, velocity spike, mixer contact, sanctions hit, bridge hop, dormant reactivation, peel chain, round amounts |
| Interactive intelligence dashboard | Live Board (alerts, watched addresses, windows, cases), Trace (flow graph, activity trend), Cases (search, timeline) |
| Automated alert generation | board rules raised once per event: outflow, sanctions contact, reported-address activity, abnormal velocity, window closing |
| Search & investigation support | search by wallet, transaction hash, account number, case id, complaint, entity; every lookup cached; every action in the audit log |
| Reporting & evidence management | hash-chained evidence packs, STR draft (FIU-IND layout), Section 63 certificate (BSA 2023), JSON bundle, chain of custody from the audit log |
| Security & access control | no public sign-up: a supervisor provisions, disables and resets accounts on the Access screen; scrypt passwords; five failed logins lock an account for fifteen minutes; HMAC-signed sessions recorded server-side so sign-out and revocation are real; route middleware; three roles with supervisor-only sign-off and case closing; every login, failure, lockout and write audited |
| Scalability | stateless engines, per-chain adapters behind one interface, disk cache with stale fallback; a new chain or list is one adapter or one file; SQLite → Postgres is a configuration change |

## Why this stack

- **Next.js 16 + React 19 + TypeScript**: one codebase for the console and its API; typed end to end from chain adapter to screen; server routes keep API keys off the browser.
- **Plain rules, no model**: every flag must be explainable in a file and defensible in court. Rules grounded in FATF indicators are auditable; a score without reasons is not.
- **Public explorers on free tiers**: no proprietary feed and no licence; every number is reproducible on a public explorer. The adapter layer means a paid or internal feed can be added later without touching the engines.
- **SQLite with an audit log**: a single file is honest for a laptop deployment and enough for a district; the schema is standard SQL and moves to Postgres unchanged.
- **Disk cache with offline replay**: public APIs rate-limit and stall; caching makes the console fast and lets a demonstration run with no network.
- **SHA-256 hash chain over canonical JSON**: standard primitives a court-appointed expert can recompute; no custom cryptography.

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
- Everything under `data/synthetic` (statements, complaints). Each file says so, and no address in those files is a real on-chain identity.
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

Open http://localhost:3000. Evaluation accounts (provisioned in the seed database; a supervisor can add, disable or reset accounts on the Access screen):

| Login | Password | Role |
|---|---|---|
| `investigator` | `golden-hour` | investigator |
| `compliance` | `fiu-ind` | compliance |
| `supervisor` | `sector-17` | supervisor |

Set `OFFRAMP_OFFLINE=1` to serve every chain lookup from the on-disk cache without touching the network.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, better-sqlite3 for users, cases, watch list, alerts, packets, packs and the audit log. Passwords are scrypt-hashed; sessions are HMAC-signed httpOnly cookies backed by a server-side session table, so logout, "sign out everywhere" and a supervisor disabling an account end access immediately. Five failed logins lock an account for fifteen minutes. There is no public sign-up: a supervisor provisions accounts on the Access screen. Roles: investigators and compliance officers work cases; only a supervisor can sign off a packet, close a case or manage accounts. Every login, failure, lockout, password change and write is audited under the login.
