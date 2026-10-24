#nullable enable
// Damage, bosses and hooks: C# port of the damage, boss and hook sections of packages/combat/src/engine.ts.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Uomd.Combat
{
    public sealed partial class Battle
    {
        private sealed class HitOptions
        {
            public bool? Crit;
            public double? ElementMult;
            public bool NoFocus;
            public string? RedirectedFrom;
            public double? ShieldMult;
            public string? Dot;
            public bool FireHooks;
        }

        // ---------------------------------------------------------------- damage

        private void DealDamage(Ctx ctx, Combatant target, EffectOpDef op, string element, bool single)
        {
            if (!target.Alive) return;
            if (target.Objective != null)
            {
                HitObjective(ctx, target);
                return;
            }
            var attacker = ctx.Actor;
            double defStat = op.DamageType == "physical" ? EffStat(target, "def") : EffStat(target, "res");
            double elementMult = ElementMultiplier(element, target);
            bool crit = _rng.Next() < (attacker.Base.Crit ?? _rules.CritChance);
            double elemResMult = EffElementResMult(target, element);
            // per-target conditional multipliers of the op itself
            double mult = op.Multiplier * RankFactor(attacker, ctx.Skill.SkillId);
            if (op.MultiplierIfObjectiveAliveId != null && ObjectiveAlive(op.MultiplierIfObjectiveAliveId)) mult *= op.MultiplierIfObjectiveAliveValue;
            if (op.MultiplierIfAllObjectivesAlive.HasValue)
            {
                var mine = Combatants.Where(c => c.Objective?.BossId == attacker.Id).ToList();
                if (mine.Count > 0 && mine.All(c => c.Alive)) mult *= op.MultiplierIfAllObjectivesAlive.Value;
            }
            if (op.Modifiers != null)
            {
                var saved = ctx.EventTarget;
                ctx.EventTarget = target;
                foreach (var m in op.Modifiers)
                {
                    if (m.Multiplier.HasValue)
                    {
                        if (Holds(m.Condition, ctx, attacker)) mult *= m.Multiplier.Value;
                    }
                    else
                    {
                        mult += Math.Min(PredicateCount(m.Condition, ctx, attacker), m.MaximumCount) * m.AddMultiplierPerCount;
                    }
                }
                ctx.EventTarget = saved;
            }
            // element-bound status effects on the target (Soaked): extra damage taken and one-shot reactions
            double elementTaken = 1;
            double reaction = 0;
            var consumed = new List<StatusInstance>();
            foreach (var s in target.Statuses)
            {
                var d = StatusOf(s.StatusId);
                elementTaken *= d?.ElementDamageTakenMultiplier != null && d.ElementDamageTakenMultiplier.TryGetValue(element, out var et) ? et : 1;
                foreach (var r in d?.Reactions ?? new List<StatusReaction>())
                {
                    if (r.Element != element) continue;
                    reaction += r.BonusDamageMultiplier;
                    if (r.ConsumeStatus) consumed.Add(s);
                    Emit(Ev("reaction", ("unit", target.Id), ("name", r.NameEn), ("bonus", r.BonusDamageMultiplier)));
                }
            }
            foreach (var s in consumed)
            {
                target.Statuses.Remove(s);
                Emit(Ev("status_removed", ("target", target.Id), ("status", s.StatusId), ("reason", "expired")));
            }
            string? attackKind = ctx.InHook ? null : ctx.ActionKind;
            double baseDmg =
                Scale(attacker, op.ScaleStat) *
                mult *
                (_rules.DefenseScale / (_rules.DefenseScale + Math.Max(0, defStat))) *
                elementMult *
                StatusProduct(attacker, "outgoing_damage_multiplier") *
                StatusProduct(target, "damage_taken_multiplier") *
                elemResMult *
                (crit ? (attacker.Base.CritDamage ?? _rules.CritMultiplier) : 1);

            var packet = new Packet { Source = attacker, Target = target, ActionKind = attackKind };
            bool hooked = attackKind != null && !ctx.SuppressHooks && op.CanTriggerPassives != false;
            var info = new HookInfo { Actor = attacker, Target = target, ActionKind = attackKind, ActionId = ctx.ActionId, Packet = packet };
            if (hooked) Fire("before_damage_dealt", info);
            ApplyContinuous(packet, "before_damage_dealt");
            if (hooked) Fire("before_damage_received", info);
            ApplyContinuous(packet, "before_damage_received");
            if (packet.Blocked)
            {
                Emit(Ev("blocked", ("unit", target.Id), ("source", attacker.Id)));
                return;
            }

            double guard = 1;
            if (single && ctx.Guarded.TryGetValue(target.Id, out var gm)) guard = gm;
            double reduction = 1;
            foreach (var r in target.Reductions.ToList())
            {
                reduction *= r.Mult;
                if (r.HitsLeft.HasValue)
                {
                    r.HitsLeft = r.HitsLeft.Value - 1;
                    if (r.HitsLeft.Value <= 0) target.Reductions.Remove(r);
                }
            }
            double bossWard = target.Boss != null ? BossWard(target) : 1;
            double raw = baseDmg * bossWard * elementTaken * (1 + reaction) * (attackKind != null && ctx.AttackBonus != null ? ctx.AttackBonus.Value : 1) * packet.OutMult * packet.InMult * guard * reduction;
            double dmg = Math.Max(1, Math.Floor(raw + 1e-9));
            ctx.LastDamage = dmg;
            ctx.LastDamageTarget = target;

            double toTarget = dmg;
            var redirect = single && attackKind != null ? target.Redirects.FirstOrDefault(r => r.Eligible.Contains(attackKind) && (r.HitsLeft == null || r.HitsLeft > 0)) : null;
            if (redirect != null)
            {
                var protector = Combatants.FirstOrDefault(c => c.Id == redirect.ProtectorId && c.Alive);
                if (protector != null && protector != target)
                {
                    double share = JsMath.RoundHalfUp(dmg * redirect.Fraction);
                    toTarget = dmg - share;
                    if (redirect.HitsLeft.HasValue)
                    {
                        redirect.HitsLeft = redirect.HitsLeft.Value - 1;
                        if (redirect.HitsLeft.Value <= 0) target.Redirects.Remove(redirect);
                    }
                    if (share > 0) Receive(ctx, attacker, protector, share, new HitOptions { Crit = crit, ElementMult = elementMult, NoFocus = op.NoFocusGain == true, RedirectedFrom = target.Id, ShieldMult = op.ShieldDamageMultiplier, FireHooks = true });
                }
            }
            if (toTarget > 0) Receive(ctx, attacker, target, toTarget, new HitOptions { Crit = crit, ElementMult = elementMult, NoFocus = op.NoFocusGain == true, ShieldMult = op.ShieldDamageMultiplier });
            if (hooked && attacker.Alive) Fire("after_damage_dealt", info);
        }

        /// <summary>Always-on rules scale the packet.</summary>
        private void ApplyContinuous(Packet packet, string ev)
        {
            foreach (var u in Combatants.ToList())
            {
                if (!u.Alive) continue;
                foreach (var m in RulesOf(u).Mods)
                {
                    if (m.Event == "stat_snapshot" || m.Event != ev) continue;
                    if (ev == "before_damage_dealt")
                    {
                        bool scope = m.AppliesTo == "all_allies_while_owner_alive" ? packet.Source.Side == u.Side : packet.Source == u;
                        if (!scope) continue;
                    }
                    else if (packet.Target != u) continue;
                    var cctx = BareCtx(u);
                    cctx.EventTarget = packet.Target;
                    cctx.EventActor = packet.Source;
                    cctx.Packet = packet;
                    if (!Holds(m.Condition, cctx, u)) continue;
                    if (ev == "before_damage_dealt") packet.OutMult *= m.DamageMultiplier;
                    else packet.InMult *= m.DamageMultiplier;
                }
            }
        }

        private void Receive(Ctx? ctx, Combatant source, Combatant target, double amount, HitOptions o)
        {
            if (!target.Alive) return;
            bool real = ctx != null && o.Dot == null;
            string? attackKind = real && !ctx!.InHook ? ctx.ActionKind : null;
            bool hooked = real && attackKind != null && !ctx!.SuppressHooks;
            if (o.FireHooks && hooked) Fire("before_damage_received", new HookInfo { Actor = source, Target = target, ActionKind = attackKind, ActionId = ctx!.ActionId });
            double incoming = amount;
            // Soul Link: a share of each hit is taken by the other linked units instead
            var link = target.Statuses.FirstOrDefault(s => StatusOf(s.StatusId)?.SharedDamageCapFraction != null);
            if (link != null && o.Dot != "soul_link")
            {
                var def = StatusOf(link.StatusId);
                var others = Living(target.Side).Where(c => c != target && c.Statuses.Any(s => s.StatusId == link.StatusId)).ToList();
                double cap = Math.Floor(target.MaxHp * (def?.SharedDamageCapFraction ?? 0));
                double share = Math.Min(Math.Floor(incoming * (link.Value ?? 0)), cap);
                if (others.Count > 0 && share > 0)
                {
                    incoming -= share;
                    double each = Math.Max(1, Math.Floor(share / others.Count));
                    foreach (var c in others) Receive(null, source, c, each, new HitOptions { Dot = "soul_link" });
                }
            }
            double remaining = incoming;
            double absorbed = 0;
            double sm = o.ShieldMult ?? 1;
            while (remaining > 0 && target.Shields.Count > 0)
            {
                var s = target.Shields[0];
                double need = Math.Ceiling(remaining * sm - 1e-9);
                if (s.Amount >= need)
                {
                    s.Amount -= need;
                    absorbed += remaining;
                    remaining = 0;
                }
                else
                {
                    double soaked = Math.Min(remaining, Math.Floor(s.Amount / sm + 1e-9));
                    absorbed += soaked;
                    remaining -= soaked;
                    s.Amount = 0;
                }
                if (s.Amount <= 0) target.Shields.RemoveAt(0);
            }
            double hpBefore = target.Hp;
            double nextHp = Math.Max(0, target.Hp - remaining);
            // a boss phase bar cannot run out: crossing the next phase threshold (or emptying) starts the change instead
            var bossState = target.Boss;
            var phases = target.Def.Boss?.Phases;
            var nextPhase = bossState != null && phases != null && bossState.Phase + 1 < phases.Count ? phases[bossState.Phase + 1] : null;
            if (bossState != null && nextPhase != null)
            {
                double threshold = Math.Floor(target.MaxHp * (nextPhase.TransitionHpPercent ?? 0.5) + 1e-9);
                if (bossState.TransitionPending || nextHp <= threshold)
                {
                    bossState.TransitionPending = true;
                    nextHp = Math.Max(1, nextHp);
                }
            }
            target.Hp = nextHp;
            var ev = Ev("damage", ("source", source.Id), ("target", target.Id), ("amount", remaining), ("absorbed", absorbed), ("hpAfter", target.Hp), ("crit", o.Crit ?? false), ("elementMultiplier", o.ElementMult ?? 1));
            if (!string.IsNullOrEmpty(o.RedirectedFrom)) ev["redirectedFrom"] = o.RedirectedFrom;
            if (!string.IsNullOrEmpty(o.Dot)) ev["dot"] = o.Dot;
            if (ctx != null && ctx.InHook) ev["counter"] = true;
            Emit(ev);
            if (remaining + absorbed > 0) target.TookDamageThisRound = true;
            if (target.Hp == 0)
            {
                var statusesAtDeath = target.Statuses.Select(s => s.StatusId).ToList();
                target.Alive = false;
                target.Shields = new List<ShieldInstance>();
                target.Statuses = new List<StatusInstance>();
                target.Mods = new List<StatMod>();
                target.Redirects = new List<RedirectInstance>();
                target.Regens = new List<RegenInstance>();
                target.Reductions = new List<DamageReduction>();
                target.OpeningGuard = null;
                target.Counters = new List<CounterInstance>();
                target.NextAttackBonus = null;
                target.Focus = 0;
                Emit(Ev("defeat", ("unit", target.Id)));
                if (o.Dot != "soul_link") Fire("after_enemy_defeated", new HookInfo { Actor = source, Target = target, ActionKind = attackKind, ActionId = ctx?.ActionId ?? 0, TargetStatuses = statusesAtDeath });
                return;
            }
            if (!o.NoFocus && o.Dot == null && remaining + absorbed > 0)
            {
                double room = _rules.FocusHitGainCapPerTurn - target.FocusGainedThisTurn;
                double gain = Math.Min(_rules.FocusHitGain, Math.Max(0, room));
                if (gain > 0)
                {
                    target.FocusGainedThisTurn += gain;
                    AddFocus(target, gain, false);
                }
            }
            if (hooked && target.Hp < hpBefore)
            {
                var info = new HookInfo { Actor = source, Target = target, ActionKind = attackKind, ActionId = ctx!.ActionId };
                Fire("after_damage_received", info);
                Fire("ally_damaged", info);
                Fire("ally_hp_threshold_crossed", info);
            }
        }

        // ---------------------------------------------------------------- bosses

        private void InitBoss(Combatant c)
        {
            c.Boss = new BossState { Phase = -1, BaseHp = c.MaxHp, BaseAtk = c.Base.Atk, BaseDef = c.Base.Def };
            EnterPhase(c, 0);
        }

        /// <summary>A phase is a fresh HP bar (level-scaled base x multiplier) with its own stats, weaknesses, objectives and opening ops.</summary>
        private void EnterPhase(Combatant c, int idx)
        {
            var bossDef = c.Def.Boss;
            var st = c.Boss;
            if (bossDef == null || st == null || idx < 0 || idx >= bossDef.Phases.Count) return;
            var phase = bossDef.Phases[idx];
            if (idx > 0)
            {
                foreach (var s in c.Statuses.ToList())
                {
                    if (StatusOf(s.StatusId)?.Category != bossDef.ClearStatusCategory || bossDef.PreserveStatusIds.Contains(s.StatusId)) continue;
                    c.Statuses.Remove(s);
                    Emit(Ev("status_removed", ("target", c.Id), ("status", s.StatusId), ("reason", "cleansed")));
                }
                c.Mods = c.Mods.Where(m => m.Amount >= 0).ToList();
                foreach (var o in Combatants)
                {
                    if (o.Objective != null && o.Objective.BossId == c.Id && !o.Objective.Persists && o.Alive) o.Alive = false;
                }
            }
            st.Phase = idx;
            st.TransitionPending = false;
            c.MaxHp = Math.Max(1, JsMath.RoundHalfUp(st.BaseHp * phase.HpMultiplier));
            c.Hp = c.MaxHp;
            c.Base.Atk = Math.Max(0, JsMath.RoundHalfUp(st.BaseAtk * phase.AtkMultiplier));
            c.Base.Def = Math.Max(0, JsMath.RoundHalfUp(st.BaseDef * phase.DefMultiplier));
            c.WeaknessOverride = phase.Weaknesses;
            foreach (var obj in phase.Objectives)
            {
                if (!Combatants.Any(o => o.Objective != null && o.Objective.ObjectiveId == obj.ObjectiveId && o.Objective.BossId == c.Id)) SpawnObjective(c, obj);
            }
            Emit(Ev("phase_change", ("unit", c.Id), ("phase", phase.PhaseId), ("hp", c.Hp), ("maxHp", c.MaxHp)));
            var ctx = NewCtx(c, c.Def.Skills[0]);
            ctx.SuppressHooks = true;
            foreach (var op in phase.EnterOps) ApplyOp(op, ctx);
            foreach (var op in phase.PassiveOps) ApplyOp(op, ctx);
        }

        private void SpawnObjective(Combatant boss, BossObjectiveDef obj)
        {
            var def = new UnitDef
            {
                UnitId = obj.ObjectiveId,
                Kind = "enemy",
                NameEn = obj.NameEn,
                Element = "Dawn",
                BaseStats = new StatsDef { Hp = obj.MaxHp, Atk = 0, Def = 0, Spd = 1 },
                Skills = new List<SkillDef> { new SkillDef { SkillId = "objective_idle", NameEn = "-", Type = "basic", PlayerTarget = "none" } }
            };
            int used = Combatants.Count(c => c.Objective != null);
            var o = MakeCombatant(def, boss.Side, 10 + used, "front", boss.Level);
            o.Objective = new ObjectiveState { ObjectiveId = obj.ObjectiveId, BossId = boss.Id, Targetable = obj.TargetableByPlayer, Persists = obj.PersistsAcrossPhases == true };
            Combatants.Add(o);
        }

        private bool ObjectiveAlive(string objectiveId) => Combatants.Any(c => c.Objective?.ObjectiveId == objectiveId && c.Alive);

        /// <summary>Product of the boss-side damage-taken multipliers whose objective condition still holds.</summary>
        private double BossWard(Combatant boss)
        {
            double m = 1;
            foreach (var mod in boss.Boss?.Modifiers ?? new List<BossModifier>())
            {
                if (mod.UntilObjective != null && !ObjectiveAlive(mod.UntilObjective)) continue;
                if (mod.WhileAny != null && !mod.WhileAny.Any(ObjectiveAlive)) continue;
                m *= mod.Mult;
            }
            return m;
        }

        /// <summary>Every damaging hit aimed at an objective removes one point of its integrity.</summary>
        private void HitObjective(Ctx ctx, Combatant o)
        {
            o.Hp = Math.Max(0, o.Hp - 1);
            Emit(Ev("damage", ("source", ctx.Actor.Id), ("target", o.Id), ("amount", 1.0), ("absorbed", 0.0), ("hpAfter", o.Hp), ("crit", false), ("elementMultiplier", 1.0)));
            if (o.Hp > 0) return;
            o.Alive = false;
            Emit(Ev("defeat", ("unit", o.Id)));
            var info = o.Objective;
            if (info == null) return;
            var boss = Combatants.FirstOrDefault(c => c.Id == info.BossId);
            Emit(Ev("objective_destroyed", ("objective", info.ObjectiveId), ("boss", info.BossId)));
            if (boss == null || !boss.Alive || boss.Boss == null) return;
            var phases = boss.Def.Boss?.Phases ?? new List<BossPhaseDef>();
            var def = phases.SelectMany(p => p.Objectives).FirstOrDefault(x => x.ObjectiveId == info.ObjectiveId);
            var bctx = NewCtx(boss, boss.Def.Skills[0]);
            bctx.SuppressHooks = true;
            foreach (var op in def?.OnDestroyed ?? new List<EffectOpDef>()) ApplyOp(op, bctx);
            var pending = boss.Boss.Telegraph;
            var tel = pending != null ? boss.Def.Skills.FirstOrDefault(k => k.SkillId == pending.SkillId)?.Telegraph : null;
            if (pending != null && tel != null)
            {
                var all = tel.InterruptIfAllObjectivesDestroyed;
                if (tel.InterruptIfObjectiveDestroyed == info.ObjectiveId || (all != null && all.All(id => !ObjectiveAlive(id)))) CancelTelegraph(boss, "objective");
            }
        }

        private void CancelTelegraph(Combatant boss, string reason)
        {
            var pending = boss.Boss?.Telegraph;
            if (boss.Boss == null || pending == null) return;
            boss.Boss.Telegraph = null;
            var skill = boss.Def.Skills.FirstOrDefault(k => k.SkillId == pending.SkillId);
            // an interrupted signature is spent: it goes on cooldown as if it had been used
            if (skill != null && skill.CooldownTurns > 0) boss.Cooldowns[skill.SkillId] = skill.CooldownTurns;
            Emit(Ev("telegraph_cancelled", ("unit", boss.Id), ("skill", pending.SkillId), ("reason", reason)));
        }

        /// <summary>Boss turn: announce a telegraphed signature, resolve one announced earlier, or act normally.</summary>
        private void BossAct(Combatant boss)
        {
            var st = boss.Boss;
            if (st == null) return;
            var pending = st.Telegraph;
            if (pending != null)
            {
                var sk = boss.Def.Skills.FirstOrDefault(k => k.SkillId == pending.SkillId);
                if (sk != null && pending.ActionsSeen >= pending.ActionsNeeded)
                {
                    st.Telegraph = null;
                    ExecuteSkill(boss, sk, null);
                    return;
                }
                // the player has not had its action yet: the boss keeps pressure with a plain strike and the intent stays
                var basic = boss.Def.Skills.FirstOrDefault(k => k.Type == "basic");
                if (basic != null) ExecuteSkill(boss, basic, null);
                return;
            }
            var skill = ChooseEnemySkill(boss);
            if (skill == null)
            {
                Emit(Ev("turn_skipped", ("actor", boss.Id), ("reason", "no_usable_skill")));
                return;
            }
            double need = skill.Telegraph?.PlayerActionsBeforeResolution ?? 0;
            if (need > 0)
            {
                st.Telegraph = new PendingTelegraph { SkillId = skill.SkillId, ActionsNeeded = need };
                var ctx = NewCtx(boss, skill);
                ctx.ActionKind = skill.Type == "passive" ? null : skill.Type;
                var targets = skill.EffectOps.Count > 0 ? Resolve(skill.EffectOps[0].TargetSelectorId, ctx, true) : new List<Combatant>();
                Emit(Ev("telegraph", ("unit", boss.Id), ("skill", skill.SkillId), ("skillName", skill.NameEn), ("targets", targets.Select(t => t.Id).ToList()), ("actionsNeeded", need)));
                return;
            }
            ExecuteSkill(boss, skill, null);
        }

        /// <summary>Phase changes wait for the end of the action that caused them.</summary>
        private void ProcessTransitions()
        {
            foreach (var boss in Combatants.ToList())
            {
                if (!boss.Alive || boss.Boss == null || !boss.Boss.TransitionPending) continue;
                var pending = boss.Boss.Telegraph;
                if (pending != null)
                {
                    var sk = boss.Def.Skills.FirstOrDefault(k => k.SkillId == pending.SkillId);
                    boss.Boss.Telegraph = null;
                    if (sk != null) ExecuteSkill(boss, sk, null);
                }
                if (boss.Alive) EnterPhase(boss, boss.Boss.Phase + 1);
            }
        }

        private void Summon(Combatant boss, string enemyId, double count)
        {
            if (!_defs.TryGetValue(enemyId, out var def)) throw new InvalidOperationException($"summon_enemies: unknown unit {enemyId}");
            for (int i = 0; i < count; i++)
            {
                if (Living(boss.Side).Count >= 5) return;
                double slot = 0;
                while (Combatants.Any(c => c.Id == $"{boss.Side}:{Fmt(slot)}:{enemyId}" || (c.Side == boss.Side && c.Objective == null && c.Alive && c.Slot == slot))) slot++;
                var unit = MakeCombatant(def, boss.Side, slot, "front", boss.Level);
                Combatants.Add(unit);
                Emit(Ev("summon", ("source", boss.Id), ("unit", unit.Id)));
            }
        }

        /// <summary>Auto Battle: break the objective that would cancel the announced intent first, otherwise leave objectives alone.</summary>
        private List<Combatant> AutoPool(List<Combatant> candidates)
        {
            var interrupting = candidates.Where(c =>
            {
                if (c.Objective == null) return false;
                var boss = Combatants.FirstOrDefault(b => b.Id == c.Objective.BossId);
                var pending = boss?.Boss?.Telegraph;
                var tel = pending != null ? boss!.Def.Skills.FirstOrDefault(k => k.SkillId == pending.SkillId)?.Telegraph : null;
                return tel?.InterruptIfObjectiveDestroyed == c.Objective.ObjectiveId || (tel?.InterruptIfAllObjectivesDestroyed?.Contains(c.Objective.ObjectiveId) ?? false);
            }).ToList();
            if (interrupting.Count > 0) return interrupting;
            var plain = candidates.Where(c => c.Objective == null).ToList();
            return plain.Count > 0 ? plain : candidates;
        }

        // ---------------------------------------------------------------- hooks

        private static bool ScopeOk(Combatant owner, EventHookDef hook, HookInfo info)
        {
            var f = hook.EventFilter;
            bool Same(Combatant? u) => u != null && u.Side == owner.Side;
            bool team = f?.Team != null;
            bool ok;
            switch (hook.Event)
            {
                case "owner_turn_start": ok = info.Actor == owner; break;
                case "before_damage_dealt":
                case "after_damage_dealt": ok = info.Actor == owner || (team && Same(info.Actor)); break;
                case "before_damage_received":
                case "after_damage_received": ok = info.Target == owner || (team && Same(info.Target)); break;
                case "ally_damaged": ok = Same(info.Target) && info.Target != owner; break;
                case "ally_hp_threshold_crossed":
                case "after_ally_healed": ok = Same(info.Target); break;
                case "after_ally_action":
                case "after_ally_ultimate": ok = Same(info.Actor); break;
                case "after_enemy_defeated": ok = info.Target != null && info.Target.Side != owner.Side; break;
                case "after_round_end": ok = true; break;
                default: ok = false; break;
            }
            if (!ok || f == null) return ok;
            if (f.IncomingActionType != null && info.ActionKind != f.IncomingActionType) return false;
            if (f.DamageActionType != null && info.ActionKind == null) return false;
            if (f.OwnerActionType != null && info.ActionKind == null) return false;
            if (f.SourceIsOwner == true && info.Actor != owner) return false;
            if (f.ExcludeOwner == true && info.Actor == owner) return false;
            if (f.AllyActionType != null && info.ActionKind != f.AllyActionType) return false;
            if (f.EventTargetFactionIs != null && info.Target?.Def.FactionId != f.EventTargetFactionIs) return false;
            return true;
        }

        private static double Count(Dictionary<string, double> d, string k) => d.TryGetValue(k, out var v) ? v : 0;

        /// <summary>Runs every living unit's hooks for an event.</summary>
        private void Fire(string ev, HookInfo info)
        {
            foreach (var owner in Combatants.ToList())
            {
                if (!owner.Alive) continue;
                foreach (var entry in RulesOf(owner).Hooks)
                {
                    var hook = entry.Hook;
                    if (hook.Event != ev || !ScopeOk(owner, hook, info)) continue;
                    var ctx = NewCtx(owner, entry.Skill);
                    ctx.EventSource = info.Actor;
                    ctx.EventTarget = info.Target;
                    ctx.EventActor = info.Actor;
                    ctx.LastTargets = info.Target != null ? new List<Combatant> { info.Target } : new List<Combatant>();
                    ctx.InHook = true;
                    ctx.SuppressHooks = true;
                    ctx.ActionId = info.ActionId;
                    ctx.Packet = info.Packet;
                    ctx.TargetStatuses = info.TargetStatuses ?? new List<string>();
                    if (!Holds(hook.Condition, ctx, owner)) continue;
                    var lim = hook.Limit;
                    string key = entry.Key;
                    string tkey = $"{key}>{info.Target?.Id ?? ""}";
                    if (lim?.PerBattle != null && Count(owner.HookBattleCount, key) >= lim.PerBattle) continue;
                    if (lim?.PerOwnerTurn != null && Count(owner.HookTurnCount, key) >= lim.PerOwnerTurn) continue;
                    if (lim?.PerRound != null && Count(owner.HookRoundCount, key) >= lim.PerRound) continue;
                    if (lim?.PerTargetPerBattle != null && Count(owner.HookTargetCount, tkey) >= lim.PerTargetPerBattle) continue;
                    string mark = $"{owner.Id}|{key}";
                    if (lim?.PerDamageAction != null && info.ActionId > 0 && _actionMarks.TryGetValue(mark, out var seen) && seen == info.ActionId) continue;
                    if (lim?.OnePendingBonus == true && owner.NextAttackBonus != null) continue;
                    if (lim?.Chance != null && _rng.Next() >= lim.Chance) continue;
                    owner.HookBattleCount[key] = Count(owner.HookBattleCount, key) + 1;
                    owner.HookTurnCount[key] = Count(owner.HookTurnCount, key) + 1;
                    owner.HookRoundCount[key] = Count(owner.HookRoundCount, key) + 1;
                    owner.HookTargetCount[tkey] = Count(owner.HookTargetCount, tkey) + 1;
                    if (info.ActionId > 0) _actionMarks[mark] = info.ActionId;
                    Emit(Ev("hook_triggered", ("unit", owner.Id), ("skill", entry.Skill.SkillId), ("event", ev)));
                    foreach (var op in hook.EffectOps) ApplyOp(op, ctx);
                }
            }
        }
    }
}
