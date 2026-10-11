# One currency for everything (D-17)

Owner intent (2026-10-11): the player earns the main currency from almost everything and spends it on wishes (characters and weapons),
character/weapon upgrades and shop materials. Upgrade materials (XP books, ascension items) come from quest-style tasks as items.
Tension is intended: a player who puts everything into wishes has less for upgrades.

## Assessment
Fine as a design, with one condition: **the tension must be a choice, never a trap.** A player who spent everything on wishes must
recover within a short, predictable time, otherwise the game punishes the very thing it advertises.

## Mechanisms (all data, no second currency)
1. **Upgrade fees are small against pull prices.** Books and ascension items gate progress; the currency part of an upgrade is a fee.
   Target: levelling a character to the current cap costs about 3-6 pulls' worth in total (a pull is 160). Weapons likewise.
2. **Demand is capped by gates, not by wallets.** Level caps are tied to account level / chapter progress, so total upgrade demand at
   any moment is bounded and known; it cannot swallow all income.
3. **A guaranteed floor of income.** Daily and half-day tasks (canon: 12-hour windows) pay a fixed amount that does not depend on
   how well the player is doing; the `Eclipse Blessing` subscription adds to it. Recovery from zero to "one levelling step" must be
   possible within one day of normal play. The simulator checks this number (see below).
4. **Planning hint in the UI.** The Summon screen shows what a pull leaves behind (done); the upgrade screens will show the cost of
   the next steps in pulls. It is information, not a lock. An optional player-set reserve is possible later; it is not the default.
5. **Prices are data.** `costPerPull` per banner, upgrade fee curves and task payouts are configuration; nothing is hard-coded.

## What changed in the code
- `eclipse_token` is the only currency; Fate's Thread and Silver Crowns are retired (migration 0009 folds balances: 1 thread = 160
  tokens, crowns / 100). No endpoint, schema or UI still mentions them.
- Banner config has `costPerPull` (default 160 = the canon conversion rate folded into the price).
- Stage rewards, mail attachments, admin grants and shop grants only allow `eclipse_token`.

## Still to build (next)
- Economy simulator: income per day (tasks, stage repeats, ads, subscription) versus sinks (wishes, upgrade fees, shop) for three
  player archetypes - all-in on wishes, balanced, never wishes - and a check that the all-in player can still afford the next
  upgrade step within a day.
- Upgrade system data (XP book items, ascension materials, level caps by account level, fee curves) and its admin editor.
- Canon numbers (economy_part1.json daily tokens 240 per half-day, 80 for three wins, ...) were designed for a wish-only currency;
  with upgrades paid from the same pool the income must be re-based, which is exactly what the simulator is for.
