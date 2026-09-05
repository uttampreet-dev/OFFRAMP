# Method

How OFFRAMP decides. Every rule below is implemented in `src/lib` and can be read there; nothing is learned from data.

## Detectors

Ten rule-based indicators in `src/lib/detectors`. Each is mapped to a category in the FATF report *Virtual Assets: Red Flag Indicators of Money Laundering and Terrorist Financing* (September 2020). FATF names the behaviour; the thresholds and logic are this project's own, and each finding states them. A detector fires with evidence lines, the transaction ids behind them and a bounded heuristic confidence, or clears with the reason.

| # | Detector | FATF red-flag category | Severity |
|---|---|---|---|
| 1 | Rapid layering | Transaction patterns: immediate onward transfer | high |
| 2 | Structuring / splitting | Transaction patterns: structuring below thresholds | high |
| 3 | P2P off-ramp counterparty | Senders and recipients: high-throughput unregistered counterparties | medium |
| 4 | Velocity spike | Transaction patterns: unusual frequency | medium |
| 5 | Mixer / tumbler contact | Anonymity: mixing and tumbling services | high |
| 6 | Sanctions list hit | Senders and recipients: sanctioned persons and entities | high |
| 7 | Cross-chain bridge hop | Transaction patterns: chain hopping | medium |
| 8 | Dormant wallet reactivated | Transaction patterns: dormant accounts suddenly active | info |
| 9 | Peel chain | Transaction patterns: layering through successive small outputs | medium |
| 10 | Round-number transfers | Transaction patterns: round amounts inconsistent with commerce | info |

The panel beside every finding states what a flag does not mean: it does not establish ownership, intent or an offence. Detectors run on the transfer window the explorer returned (about 25 on Bitcoin, 50 on Ethereum, 50 TRC-20 on TRON), and the screen shows how many transfers and hops were examined.

## Risk score

`src/lib/risk.ts`. Additive, capped at 100, every point tied to a named rule and its evidence. The weights are prioritisation heuristics set for this prototype so that a sanctions listing outranks a community report and direct exposure outranks a single detector. They are not probabilities and have not been statistically calibrated. The score orders wallets for attention; it is not a verdict.

| Factor | Points | Rule |
|---|---|---|
| Address on the OFAC SDN list | +60 | sanctions screening |
| Address is a known mixer contract | +30 | known-entity list, sourced |
| Sanctioned counterparties (1–2 / 3 or more) | +25 / +35 | direct exposure to listed addresses |
| Community report on the address | +20 | a report, not a finding |
| Mixer counterparty | +15 | known-entity list |
| Reported counterparties | +8 | community blacklist |
| Each fired detector (high / medium / info) | +12 / +8 / +4, detector total capped at 40 | the category on the finding |

A sanctions detector that fires on the same fact as a listing or exposure factor is not counted twice. Bands: `low` below 20, `elevated` from 20, `high` from 50, `critical` from 80. The same function scores lookups, Trace, Red Flags, Screen and the Live Board.

## Bridge correlation

`src/lib/bridge/correlate.ts`. For every on-chain outflow and every INR credit that lands after it inside the window:

```
expected  = value × INR rate for that asset on that day
amount    = 1 − (|credit − expected| / expected) / tolerance        tolerance 2 %, 5 % or 10 %
time      = 1 − (credit time − outflow time) / window              window 2 h, 6 h or 24 h
strength  = √(amount × time)
```

The geometric mean means a perfect amount with a late credit still scores lower. Candidates within 0.08 of each other on the same credit are marked ambiguous and shown together; candidates upstream of the best match are marked as such. The INR rate comes from `data/synthetic/fx.json` when present, otherwise from documented fallback reference levels that the screen labels *fallback*.

A linkage is a plausible candidate by amount and timing. It does not prove that a particular bank credit came from a particular crypto transaction, and OFFRAMP never presents it as ownership.

## Withdrawal window

`src/lib/intercept`. Three steps, each shown on the Intercept screen with its result:

1. **Measure.** Every inflow to the wallet is paired with the next outflow and the lag recorded.
2. **Estimate.** With three or more pairs, the median lag is the window, floored at 10 minutes and capped at 48 hours. Basis shown as *observed on this wallet*.
3. **Fall back.** With fewer pairs, a 2-hour policy default is used and labelled as a planning figure, not a measurement.

The freeze-request packet is canonical JSON hashed with SHA-256 on sealing. A supervisor's sign-off is a separate action with its own audit row; the window then appears on the Live Board.

## Live Board alerts

`src/lib/board`. Watched addresses are re-evaluated from the chain cache every 60 seconds. Each alert is keyed to its event so a re-poll never duplicates it.

| Rule | Level | Fires when |
|---|---|---|
| Outflow | amber, red if the address is sanctioned | a watched address sends funds |
| Sanctions contact | red | a watched address transacts with an OFAC-listed counterparty |
| Velocity | amber | five or more new transfers on a watched address since the last poll |
| Reported-address activity | amber | a community-reported watched address moves |
| Window closing | red | an open freeze window has under fifteen minutes left |

Alerts appear as toasts across the console and, if the officer opts in and the browser grants permission, as browser notifications. Nobody is paged and nothing is transmitted.

## Evidence chain

`src/lib/evidence`. Each artefact is serialised as canonical JSON and hashed with SHA-256. The hashes are chained: `h₀ = sha256(a₀)`, `hᵢ = sha256(hᵢ₋₁ ‖ aᵢ)` over the hex strings, and the last link is the root. Sealing writes a manifest and an audit row and does not alter the artefacts. The Evidence screen recomputes the chain on demand; the Section 63 certificate draft records whether the recomputation matched. The investigation report prints the SHA-256 of its own body.

To recompute a root from an exported bundle: hash each artefact's canonical body, fold `sha256(prev ‖ aᵢ)` over the list starting from the empty string, and compare with the manifest.

## Co-spend clustering

`src/app/api/cospend`, Bitcoin only. Addresses that appear together as inputs of the same transaction as the seed are grouped under the common-input-ownership heuristic (Meiklejohn et al., 2013). The screen says *likely one owner*; it is a heuristic and is not proof.

## Syndicates

`src/lib/syndicates`. Complaints are joined when their money reached the same cash-out wallet, transitively, and each group reports loss, tempo, cities, rails and its wallets with screening. The complaints dataset is synthetic and every result says so.
