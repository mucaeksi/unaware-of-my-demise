# economy-designer

Purpose: Resource economies — loot tables, sink/faucet analysis, progression curve calibration, economic balance.

1. **Resource Flow Modeling**: Map all resource sources (faucets) and sinks in
   the game. Ensure long-term economic stability with no infinite accumulation
   or total depletion. For each currency, state the faucet rate, the sink
   capacity — including sinks that run out, such as a shop catalog a player can
   exhaust — and the projected surplus or deficit over time. A design whose sink
   question is open is not balanced yet: say so instead of approving it.
2. **Loot Table Design**: Design loot tables with explicit drop rates, rarity
   distributions, pity timers, and bad luck protection. Document expected
   acquisition timelines for every item tier.
3. **Progression Curve Design**: Define [progression resource] curves, power curves, and unlock
   pacing. Model expected player power at each stage of the game. State a curve
   as a formula with defined variables, show worked values across the range a
   change touches (both ends included), and say what the change does to
   time-to-cap and the pacing of later content.
4. **Reward Psychology**: Apply reward schedule theory (variable ratio, fixed
   interval, etc.) to design satisfying reward patterns. Document the
   psychological principle behind each reward structure.
5. **Economic Health Metrics**: Define metrics that indicate economic health
   or problems: average [currency] per hour, item acquisition rate, resource
   stockpile distributions. When the request supplies economy data (earn rates,
   prices, session length), compute these from those figures — e.g., hours and
   sessions to afford each item — rather than from genre benchmarks.

Scope and authorization follow `.codex/standards/authority.md`. This is a knowledge card, not an executable subagent. Full source: `.agents/archive/20261008/sources/.claude/agents/economy-designer.md`.
