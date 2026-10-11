# Single-currency tuning proposal — SOL-7

**Owner review proposal, not applied**, 2026-10-11. Keep `eclipse_token` (display **Bell's Remains**) as the only money, a pull at **160**, and material/XP/account/story gates. Ration is energy, not a second spendable money. English player text; spoken content Japanese. No D1/config/catalog/purchase price was changed.

Sources: `docs/ECONOMY_SINGLE_CURRENCY.md`; runtime `economy_part1.json`, `battle_rules_part1.json`, `drop_tables_part1.json`, `items_part1.json`, `chapters_part1.json` under `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/`; `tools/seed_catalog.ts`; `packages/economy/src/{flow,progression,drops}.ts`; `apps/api/src/{admin/ops,ads/service,progress/service,tasks/service,progression/characters,gear/service}.ts`. Source SHA-256 values and exact arithmetic reports are in [SIMULATOR_OUTPUT.json](SIMULATOR_OUTPUT.json).

## Verified baseline and discrepancies

| Source observation | Consequence |
|---|---|
| Canon window says maximum 240, consisting of 80 three-win + 40 kit + **120 ads**, every 12 h | Non-ad task income is **120/window = 240/day**, not 240/window. The assessment doc's “daily tokens 240 per half-day” includes ads. Do not add that 240 to separate ad income. |
| Canon four ads/window is obsolete; `AD = {token:30, perWindow:5, windowHours:12}` | Current upper sustained rate is **300 tokens/day**, optional, assuming ten successful verifications spread over rolling windows. UTC reset does not reset this cap. DEFAULT_FLOW ads 240/day is an old assumption. |
| Weekly 320 + 320 + 160 = 800/week | 800/7 is an amortized average, not a daily guaranteed payment. Objectives are 15 eligible wins, 5 boss wins, 3 three-star wins, with segment timing and 7-day claim grace. |
| Subscription 1600 immediate + 187 × 60 halfdays = 12,820 over 30 days | Model **startBalance 1600 + subscription 374/day**. Adding 427.333/day and 1600 at start would double-count the instant grant. Benefits depend on actual verified entitlement/mail claims. |
| `DEFAULT_FLOW` fee 150 × 40 available steps | 6,000 tokens = 37.5 pulls: unsuitable as a small-fee progression baseline. Its `floorHolds` can still be true while wishes-first upgrades stall. |
| Actual seeded character fee is `ceil(1 + .5L)` | Levels 1→20 cost **119**, plus actually paid ascensions **50 + 200 + 500 = 750**, total **869** = 5.43125 pulls. Row cap5/fee10 is the initial cap record, not paid by the `ascension + 1` operation. The problem is the **500-token single ascension spike**, not excessive lifetime cost. |
| Seeded equipment fee `ceil(.5 + .25L)` | Levels 1→20 cost **64**, 0.4 pulls; rivet milestones have no separate token fee. This is below the assessment's 3–6-pull weapon target. |
| Skill fee per target rank 2/3 is 10/30; rank caps basic3/active3/passive2/ultimate3 | Full four-skill fee is **130** (4 × 10 + 3 × 30), separate from leveling. Materials/rank unlocks remain gates. |
| Canon drop common crowns45–90 folds to token1; ordinary boss250–450 to3–5; final900–1100 to9–11 | These are placeholders after the one-currency migration, not evidence of a tuned live economy. Never reintroduce old currency names. |
| Stage claim adds explicit node rewards **and** configured drop entries | Put each token payout in exactly one location; duplicating node.repeat + drop.repeat silently pays twice. |
| Base signed chapter has t1 without ration class or rewards, patch adds t2 | Source proposals are not already deployed guaranteed beginner income. Zero-Ration tutorial wins do not count toward eligible task wins. |

The canonical main-story 1-1 guided battle and current revised T-1/T-2/T-3 tutorial are different content versions. Resolve their content mapping before using any exact tutorial reward/unlock node. Seed scripts use INSERT OR IGNORE, so they are not proof of existing staging D1 configuration.

## Concrete sources to propose

| Source | Proposed payout | Reason and boundary |
|---|---|---|
| **Daily supplies** (new server-authoritative claim) | **80 tokens once per UTC day**, no spend/win/ad/subscription condition | Guaranteed recovery floor. New claim type/service required: not currently present. Accessible after account creation, at account/story caps, and without Ration. Stable player+UTC-day grant key; no catch-up stacking. |
| `win_three_battles` | **60 tokens + 3 bound_chronicle** per 12-h window | Two windows give 120 tokens/day, 3,000 XP as items. Eligible server-validated Ration-consuming wins, including sweep; no free tutorial farming. Down from 80 to fund supplies without raising total daily task maximum. |
| `improve_company_kit` | **20 tokens + 1 bound_chronicle** per 12-h window | Two windows give 40 tokens/day. Optional after real paid level-up; no dependence for the supply floor, no refund loop. This reward may be unavailable at all progression caps. |
| Window completion | **4 bound_chronicle + 400 account XP**, no tokens | Retain existing two-task requirement and canonical item/account-XP amounts. Not needed for supplies. Max with both windows is 8,000 character XP in items and 800 account XP/day. |
| Weekly cycle | **320 / 320 / 160** unchanged | Preserve canon segment objectives and grace. Never include amortized weekly income in the strict recovery floor. |
| Rewarded ad | **30 tokens**, unchanged; 5 per rolling12h | Optional upside, maximum sustained 300/day. Never force inside dialogue/cinematic/tactical choices. Current payout/cap are code constants, not yet fully editable data. |
| Subscription | **1600 + 187/halfday × 60**, unchanged | Preserve approved benefit design; no new real-money price/product/renewal promise. |
| Campaign repeat, Ration6 | **4 tokens fixed** | Small guaranteed currency drop per eligible win; six normal daily wins give 24. Predictable, not a random wallet floor. |
| Material hunt repeat, Ration8 | **4 tokens fixed**, plus targeted material below | Lower token/Ration than campaign; material is the reason to enter. New table/unlock mapping needs Claude. |
| Gear dungeon repeat, Ration10 | **5 tokens fixed** | Gear route does not dominate campaign for money. |
| Special boss repeat, Ration10 | **6 tokens fixed**, including final boss | Slight boss premium but no first-clear windfall on every repeat. If a story boss is Ration6 instead, pay4; **payout follows actual ration class**, not its name. |
| Normal paid story first clear | **40 tokens once**, optional three-star bonus **20 once** | Progression reward outside repeat income; do not include in daily simulator. |
| Paid story boss first clear | **80 tokens once**, three-star bonus **40 once** | Preserve first-clear boss-set guarantee separately. No identical token first-clear entry in both node and drop table. |
| Zero-cost opening/tutorial | **0 repeat tokens/drops**; optional **40 once per revised T-stage** | One-time teaching reward proposal only; mapping/version must be resolved. No grant on failed/incomplete battle, no repeat currency or gear exploit. |

At full two-window participation, task tokens remain **80 + 2×60 + 2×20 = 240/day**. Supplies redistribute existing maximum, not add 80 on top. Once supplies are spent on wishes, pausing wishes until the next claim restores at least80 within a daily cycle; this does not mean every instant of play produces80. Show next supply availability. One-window players still have80 guaranteed plus optional60/20, without advertising.

Ration canon: cap100, regen1/300s =288/day theoretical, inn meal30, campaign6/material8/gear10/boss10, no loss charge/refill sale. Cap/offline loss and play cadence reduce this; **318 is a ceiling, not guaranteed usable daily Ration**. Campaign token farming theoretical upper bound `floor(318/6)×4 = 212/day`, far below claiming a 24/day assumption is a farm ceiling. Audit sweep eligibility, energy conservation, zero-cost nodes and simultaneous claims.

### Material/drop proposals

Keep existing item IDs, XP values and first-clear gear identities; no new monetary substitute. These are proposed table values, not changes to narrative files.

- All seven `story_*_common` tables: replace the old folded-crown currency entry with the single fixed4-token repeat **only when assigned to campaign6 nodes**. Keep torn pages1–2 at80%, existing uniform seven-item crafting pool1–2 at35%, weapon pool3/4★8%, armor pool3/4★8%, accessory pool3/4★12%. Independent rolls; no gear pity claim. Expected page XP120/run; expected crafting items0.525/run, and each specified uniform item about0.075/run. Random common drops do not guarantee ascension materials.
- Targeted material hunt table variants: guaranteed **1 chosen catalog material/run**, plus **35% chance of one more of the same material**, currency4. Select one existing iron_oath_seal/alchemy_core/bellglass_shard/blacksmith_rivet/tactical_notes/hymn_leaves route by unlocked content; no player-chosen loot sent untrusted to the server. Expected1.35 items/run. Worst-case quantity guarantee: a character needs8 iron seals,13 alchemy cores,8 bellglass total; **29 targeted wins** suffice regardless of bonus RNG if all routes are open. Stage availability/gates are still UNKNOWN.
- Gear dungeon: currency5, guaranteed **one weapon/armor/accessory from a declared route's 3/4★ pool**, plus8% chance of a second from that same pool. No5★ randomly introduced. Pool probabilities/templates must exist; empty pools currently return nothing and must fail configuration review.
- Non-final boss repeats: currency6 only if ration10, existing reliquary_medal1–2 guaranteed and boss-set4★35% remain; first clear guarantees the canonical specified boss set4★ **once**. Do not silently award a first-clear guarantee on every repeat.
- Final boss: currency6 if ration10 (4 if campaign6); retain canonical unwritten_hour_cinder2 and illuminated_chronicle2–3 repeat materials pending owner farming review. **Conflict:** `story_boss_final.repeatable_rewards` includes concrete first_eclipse necklace5★ at100%, while `boss_set_guarantees` says final5★ is first-clear-only. **Proposal:** one guaranteed5★ first clear, no guaranteed repeat5★; owner/narrative must resolve this contradiction before implementation. No canon edited here.

Targeted hunts and reliable beginner Ration-consuming battles must be available before relevant material gates. Do not require higher-level clears to obtain the materials needed to reach those levels. Drop probabilities are conditional on a verified win and an eligible node; no client-local minting.

## Concrete fee curve and gates

| Fee/config | Proposed value | Arithmetic |
|---|---|---|
| Character `fee` | **base10, increment2**, charged `ceil(10 + 2L)` for L→L+1 | 12 atL1, 48 atL19; nineteen levels sum **570**. |
| Ascension cap5 initial row | **fee0**, items[]; initial cap record | No paid operation at starting cap. Do not invent a fourth paid ascension. |
| Ascension unlock cap10/15/20 | **30 / 60 / 80 tokens** | Retain canonical account gates5/10/15 and item quantities3 iron;5 alchemy+5 iron;8 bellglass+8 alchemy. Paid sum170. |
| Full character level1→20 with paid ascensions | **740 tokens = 4.625 pulls** | Within 3–6-pull goal; worst single operation80, not500. |
| Skills | **10 / 30** per target rank2/3, unchanged | All canonical four skills sum130; character+skills **870 = 5.4375 pulls**, still under6. Existing books/materials/rank gates preserved. |
| Weapon/armor `fee` | **base16, increment1**, L→L+1 | 17 atL1,35 atL19; nineteen levels **494 = 3.0875 pulls**. Milestone fees remain0; rivets1/2/3 at5/10/15 remain. |
| Shop materials | **bound_chronicle20, iron_oath_seal20, alchemy_core30, bellglass_shard40, blacksmith_rivet20 tokens each** | Optional convenience proposed, no daily mandatory shopping. Each individual item is affordable from supplies; stock cap5 per player/day per item proposed. Items are earned through tasks/hunts too. Schema/product/stock enforcement must be reviewed; not Play real-money prices. |

Keep existing XP formulas and stat growth. Account-level cap and material gates limit demand; do not set a separate money gate. Existing story gates, where configured, stay. Full XP level1→20 requires **26,030 XP** by the source formula; two heroes52,060 XP, before skill/material demands. Fully completing daily tasks gives8,000 XP/day in books, enough in about7 such days for two heroes if unlocked caps permit it; this is not a seven-day guaranteed campaign clear or account-level forecast. Gate cadence/XP waste and single-book batch fees need real progression simulation.

A zero-balance player with XP/materials and an open gate can fund **one most expensive next step80** from a single daily supply, with no ads/subscription/weeklies/stage wins. “Recovery” is a wallet guarantee; it does not grant missing materials, beat a boss or bypass a gate. Multi-level book batches may cost several level fees; preview batch cost and allow smaller items/quantities. Supply makes the wallet choice recoverable even when the optional kit task cannot complete.

## Executed simulator evidence

Task shorthand `/admin/api/economy` refers to the actual **GET `/admin/api/economy/defaults`** and **POST `/admin/api/economy/flow`**, viewer permission required. The POST calls `analyzeFlow` directly. I executed **that exact checked-in pure function locally**, using TypeScript5.9.3 transpilation, with eight explicit input models. **No authenticated staging HTTP call, live economy observation or device session occurred.** Full input/output and source hashes: SIMULATOR_OUTPUT.json. An operator can submit each `runs[].report.model` unchanged to the POST route to compare authenticated API output; no tuning is persisted by that simulation route.

Thirty days, balance0 except subscription model, pull160; normal model assumes240 tasks +24 campaign repeat/day +800/7 weekly. The simulator has no `stage` field, so **264 in `income.tasks` explicitly combines tasks and stage tokens**, and adds neither first-clears nor random loot. Normal two-character demand is44 operations (38 levels +6 ascensions), mean fee740/22 =33.63636; it is a cash proxy, not chronological variable-fee progression. The conservative run charges80 for every step.

| Run | Archetype | Pulls | Paid steps | Days with zero wanted steps afforded | Longest block | End tokens |
|---|---|---:|---:|---:|---:|---:|
| Unmodified defaults | All wishes first | 110 | 1/40 | 29 | 23 | 79 |
| Unmodified defaults | Balanced upgrades first | 73 | 40/40 | 0 | 0 | 149 |
| Unmodified defaults | Never wishes | 0 | 40/40 | 0 | 0 | 11,829 |
| Proposed normal, no ads, mean fee | All wishes first | 61 | 44/44 | 0 | 0 | 109 |
| Proposed normal, no ads, mean fee | Balanced | 61 | 44/44 | 0 | 0 | 109 |
| Proposed normal, no ads, mean fee | Never wishes | 0 | 44/44 | 0 | 0 | 9,869 |
| Proposed normal, no ads, every fee80 | All wishes first | 60 | 21/44 | 9 | 1 | 69 |
| Proposed normal, no ads, every fee80 | Balanced | 48 | 44/44 | 0 | 0 | 149 |
| Proposed normal, no ads, every fee80 | Never wishes | 0 | 44/44 | 0 | 0 | 7,829 |
| Proposed normal, optional max ads | All wishes first | 120 | 34/44 | 0 | 0 | 5 |
| Proposed normal, optional max ads | Balanced | 117 | 44/44 | 0 | 0 | 149 |
| Proposed normal, optional max ads | Never wishes | 0 | 44/44 | 0 | 0 | 18,869 |
| Proposed normal, subscription, no ads | All wishes first | 143 | 38/44 | 9 | 1 | 10 |
| Proposed normal, subscription, no ads | Balanced | 141 | 44/44 | 0 | 0 | 129 |
| Proposed normal, subscription, no ads | Never wishes | 0 | 44/44 | 0 | 0 | 22,689 |

Strict supply-only model:80/day, no optional sources, fee80, one wanted step/day and22 available. All wishes-first and balanced both pay22 steps and make4 pulls over30 days, ending0; never-wishes ends640. Recovery **1 day**. Arithmetic does not implement the proposed supply feature.

Important limitations of actual function:

- `blockedDays` counts **zero** upgrades, not inability to buy all wanted upgrades. Thus ads run34/44 with zero blocked days still misses10 desired operations. Daily averages/pull residuals can make higher income alter scheduling unfavorably; the subscription run shows this. Do not promise every wishes-first player completes all upgrades.
- `recoveryDays` is `ceil(fee × max(1,wantedStepsPerDay) / grossDailyIncome)` and means **pause wishes**, not keep wishing. Source defaults report1 day despite29 blocked days. Proposed strict floor excludes optional sources and uses highest real fee.
- Shop is deducted **before** either policy, while recovery calculation ignores shop. Counterexample supply80/shop80/fee80 reports `floorHolds:true`, but all three archetypes buy **zero** steps and block30 days. Net available income0 means recovery is impossible unless optional shopping stops. The JSON records `net_recovery_days_after_shop:null` for this counterexample.
- Weekly and subscription averages erase discrete mail/segment timing; float results round output balances. Materials, gates, initial free ownership, gear/skill curves, battle difficulty, stamina, SKU conversions and cohort behavior are not simulated. These results establish cash choices, not release balance.

For balanced players, proposed mean model pays the two starter upgrades plus61 pulls/30days with both windows/weekly participation. Pure wishes-first gets the same long-run result in that particular average model; the maximum-fee sensitivity exposes the intended short-term tradeoff. Never-wishes accumulates currency after gates; optional shop/new roster demand should absorb some surplus without mandatory spending. No pity/rate/duplicate rules are changed.

## UNKNOWN / implementation handoff

E01 owner approval for supplies80 and redistribution60/20; new claim type needs server code and tests. E02 actual authenticated staging config differs from seed until exported; confirm current node/ration/reward/drop mappings. E03 material hunt routes/unlocks, battle difficulty and gate cadence. E04 final boss5★ first-clear/repeat contradiction needs owner/narrative resolution. E05 shop catalog and enforceable daily per-player caps. E06 account1/capped-roster supply access and beginner repeat wins; supplies must never require a purchase or upgrade. E07 gross-recovery metric vs shop and chronological variable-fee simulator. E08 leave approved paid benefits and Play prices unchanged; actual subscription claims/revocations remain billing QA work.

Acceptance for this proposal: source totals distinguished from placeholders/obsolete multi-currency fields; task/ad/stage/drop/fee values explicit; all three archetypes from the real function saved; strict no-ad recovery and shop counterexample shown; no applied changes. Before shipping, Claude must validate the proposed configs, run discrete period/variable-fee/material-gate simulations (including one-window/missed-weekly/capped rosters), check ledger conservation/idempotent concurrent claims and refunds, prevent zero-cost drop farming, and collect real device/cohort results.
