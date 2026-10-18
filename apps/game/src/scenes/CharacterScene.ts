import { REF_W } from '../config';
import { currency } from '../net/currency';
import { Services } from '../services';
import { planAscension, planLevelUp, planSkillUpgrade } from '../ui/growth';
import { errText, HubScreen } from '../ui/hubScreen';
import { stars } from '../ui/format';
import { describeCompanionAttachment, nextPortraitExpression } from '../ui/pilotAttachment';
import { F, T } from '../ui/theme';

const SLOTS = ['weapon', 'armor', 'necklace', 'ring'] as const;

/** One companion: level and ascension (materials from the server-side stacks), skill ranks, final stats and the four gear slots. */
export class CharacterScene extends HubScreen {
  protected readonly heading = 'COMPANION';
  protected override readonly backTo = 'Roster';
  private id = '';
  private busy = false;
  private lastOutcome = '';
  private expression = 'composed';

  protected override init(data: { id?: string }): void {
    const nextId = data.id ?? '';
    if (nextId !== this.id) {
      this.lastOutcome = '';
      this.expression = 'composed';
    }
    this.id = nextId;
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    const releaseId = await Services.ready().content.activeReleaseId();
    const [mine, roster, names, stacks, gear, st] = await Promise.all([api.characters(releaseId), api.roster(releaseId), api.catalogNames(releaseId), api.stacks(), api.gear(releaseId), api.characterStats(this.id, releaseId).catch(() => null)]);
    const c = mine.characters.find((x) => x.id === this.id);
    const meta = roster.find((x) => x.id === this.id);
    if (!c || !meta) {
      this.text(REF_W / 2, 400, mine.unavailable?.some((c) => c.id === this.id) ? 'This companion is unavailable in this content version. Your ownership is preserved.' : 'You do not own this companion.', { fontSize: '40px', align: 'center', wordWrap: { width: 1400 } }).setOrigin(0.5);
      return;
    }
    const have = new Map(stacks.map((s) => [s.item_id, s.qty]));
    const nm = (id: string): string => names.get(id) ?? id;
    const accountLevel = mine.account?.level ?? 1;
    const attach = describeCompanionAttachment(this.id, meta.element, meta.role);

    if (this.lastOutcome) {
      this.text(REF_W / 2, 134, this.lastOutcome, { fontSize: '22px', color: T.heal, align: 'center', wordWrap: { width: 1560 } }).setOrigin(0.5);
    }

    this.card(520, 442, 880, 548, meta.rarity === 5 ? 'hot' : 'normal');
    this.text(520, 206, meta.name_en, { fontFamily: F.display, fontSize: '48px', fontStyle: '600', color: meta.rarity === 5 ? '#ffd86b' : T.text }).setOrigin(0.5);
    this.text(520, 254, `${stars(meta.rarity)}   ${attach.tacticalBadge}   ·   Account Lv ${accountLevel}`, { fontSize: '23px', color: T.dim }).setOrigin(0.5);
    this.text(520, 288, `${attach.bondTitle}: ${attach.bondLine}`, { fontSize: '19px', color: T.gold, align: 'center', wordWrap: { width: 840 } }).setOrigin(0.5);
    if (attach.availableExpressions.length > 1) {
      this.button(850, 206, {
        label: `EXPR: ${this.expression.toUpperCase()}`,
        w: 196,
        h: 44,
        fontSize: 16,
        onClick: () => {
          this.expression = nextPortraitExpression(this.id, this.expression);
          void this.refresh();
        }
      });
    }
    this.text(520, 330, `Level ${c.level} / ${c.cap}    Ascension ${c.ascension}`, { fontSize: '36px' }).setOrigin(0.5);
    this.text(520, 372, c.xpToNext === null ? 'Maximum level' : `XP ${c.xp} / ${c.xpToNext}`, { fontSize: '25px', color: T.dim }).setOrigin(0.5);
    const s = st?.stats ?? {};
    this.text(520, 424, ['hp', 'atk', 'def', 'spd'].map((k) => `${k.toUpperCase()} ${Math.round(s[k] ?? 0)}`).join('    '), { fontSize: '32px', color: T.gold }).setOrigin(0.5);

    const lvPlan = planLevelUp({
      character: c,
      accountLevel,
      balance: this.balance,
      have,
      xpItems: api.xpItems,
      cfg: api.progressionConfig,
      currencyName: currency.name,
      itemName: nm
    });
    const ascPlan = planAscension({
      character: c,
      accountLevel,
      balance: this.balance,
      have,
      currencyName: currency.name,
      itemName: nm
    });

    this.text(520, 474, `Level-Up Plan: ${lvPlan.costSummary}  ·  ${lvPlan.canExecute ? lvPlan.resultSummary : lvPlan.reason}`, { fontSize: '20px', color: lvPlan.canExecute ? T.text : T.dim, align: 'center', wordWrap: { width: 840 } }).setOrigin(0.5);
    this.text(520, 514, `Ascend Plan: ${ascPlan.costSummary}  ·  ${ascPlan.canExecute ? ascPlan.resultSummary : ascPlan.reason}`, { fontSize: '20px', color: ascPlan.canExecute ? T.text : T.dim, align: 'center', wordWrap: { width: 840 } }).setOrigin(0.5);

    this.button(340, 600, {
      label: 'LEVEL UP',
      sub: lvPlan.canExecute ? `Lv ${lvPlan.fromLevel}→${lvPlan.toLevel} · ${lvPlan.fee} ${currency.name}` : lvPlan.reason.replace(/^Blocked:\s*/i, ''),
      w: 400,
      h: 120,
      fontSize: 30,
      variant: 'hot',
      onClick: () => void this.act(async () => {
        if (!lvPlan.xpItem) return;
        const r = await api.levelUp(this.id, [{ itemId: lvPlan.xpItem.itemId, quantity: 1 }], releaseId);
        const feeSpent = r.spent?.fee ?? lvPlan.fee;
        const wasted = r.wastedXp ?? lvPlan.wastedXp;
        const bal = r.balance ?? lvPlan.balanceAfter;
        this.lastOutcome = `Last Action: Level ${lvPlan.fromLevel} → ${r.level} (+${r.gainedXp ?? lvPlan.xpItem.xp} XP, waste ${wasted} XP) · Spent 1 ${lvPlan.xpItem.name} & ${feeSpent} ${currency.name} · Wallet ${bal}`;
        this.say(`Level ${lvPlan.fromLevel} → ${r.level}`);
      })
    }).setEnabled(lvPlan.canExecute);

    this.button(700, 600, {
      label: 'ASCEND',
      sub: ascPlan.canExecute ? `Cap ${ascPlan.fromCap}→${ascPlan.toCap} · ${ascPlan.fee} ${currency.name}` : ascPlan.reason.replace(/^Blocked:\s*/i, ''),
      w: 400,
      h: 120,
      fontSize: 30,
      onClick: () => void this.act(async () => {
        const r = await api.ascend(this.id, releaseId);
        const feeSpent = r.spent?.fee ?? ascPlan.fee;
        const bal = r.balance ?? ascPlan.balanceAfter;
        this.lastOutcome = `Last Action: Ascension ${ascPlan.fromAscension} → ${r.ascension} (Cap Lv ${ascPlan.fromCap} → ${r.newCap ?? ascPlan.toCap}) · Fee ${feeSpent} ${currency.name} · Wallet ${bal}`;
        this.say('Ascended');
      })
    }).setEnabled(ascPlan.canExecute);

    if (c.nextAscension) {
      this.text(520, 676, `${c.nextAscension.items.map((i) => `${nm(i.itemId)} ${(have.get(i.itemId) ?? 0)}/${i.quantity}`).join('  ·  ')}  ·  ${Math.ceil(c.nextAscension.fee)} ${currency.name}`, { fontSize: '20px', color: T.dim }).setOrigin(0.5);
    }

    const res = c.resonance;
    const shards = c.shards ?? 0;
    if (res) {
      const resLabel = `Memory Shards: ${shards}  ·  Resonance ${res.tier}/${res.maxTier} (+${res.bonusPct}% HP/ATK/DEF, optional keepsake)`;
      this.text(520, 710, resLabel, { fontSize: '19px', color: T.gold }).setOrigin(0.5);
      const canAttune = res.nextShardCost !== null && shards >= res.nextShardCost;
      if (canAttune) {
        this.button(360, 750, {
          label: `ATTUNE (${res.nextShardCost})`,
          w: 280,
          h: 52,
          fontSize: 20,
          onClick: () => void this.act(async () => {
            const out = await api.attuneShards(this.id, releaseId);
            this.lastOutcome = `Last Action: Memory Resonance Tier ${out.resonance.tier}/${out.resonance.maxTier} (+${out.resonance.bonusPct}% HP/ATK/DEF) · Spent ${out.spentShards} Memory Shards`;
            this.say(`Resonance Tier ${out.resonance.tier}`);
          })
        });
      }
      if (res.excessShards > 0) {
        this.button(canAttune ? 680 : 520, 750, {
          label: `EXCHANGE ${res.excessShards} EXCESS`,
          w: 300,
          h: 52,
          fontSize: 20,
          onClick: () => void this.act(async () => {
            const out = await api.convertExcessShards(this.id, res.excessShards, releaseId);
            this.lastOutcome = `Last Action: Converted ${out.convertedShards} excess Memory Shards into ${out.convertedShards} ${nm(res.excessItemId)}`;
            this.say('Excess shards exchanged');
          })
        });
      }
    }

    // skills
    this.text(1380, 175, 'SKILLS', { fontFamily: F.display, fontSize: '34px', color: T.gold }).setOrigin(0.5);
    c.skills.forEach((sk, i) => {
      const y = 248 + i * 116;
      const skPlan = planSkillUpgrade({
        skill: sk,
        characterLevel: c.level,
        balance: this.balance,
        have,
        currencyName: currency.name,
        itemName: nm
      });
      this.card(1380, y, 820, 104, 'dim');
      this.text(995, y - 24, `${sk.name}  (${sk.type} · Rank ${sk.rank}/${sk.maxRank})`, { fontSize: '25px' }).setOrigin(0, 0.5);
      this.text(995, y + 6, skPlan.costSummary, { fontSize: '19px', color: T.dim }).setOrigin(0, 0.5);
      this.text(995, y + 31, skPlan.canExecute ? skPlan.resultSummary : skPlan.reason, { fontSize: '19px', color: skPlan.canExecute ? T.heal : T.crimson }).setOrigin(0, 0.5);
      const n = sk.next;
      this.button(1655, y, {
        label: n ? 'RANK UP' : 'MAX',
        sub: n ? `Rank ${sk.rank}→${n.rank}` : undefined,
        w: 220,
        h: 84,
        fontSize: 24,
        onClick: () => void this.act(async () => {
          const r = await api.upgradeSkill(this.id, sk.skillId, releaseId);
          const feeSpent = r.spent?.fee ?? skPlan.fee;
          const bal = r.balance ?? skPlan.balanceAfter;
          this.lastOutcome = `Last Action: ${sk.name} Rank ${skPlan.fromRank} → ${r.rank}/${sk.maxRank} · Fee ${feeSpent} ${currency.name} · Wallet ${bal}`;
          this.say(`${sk.name} improved`);
        })
      }).setEnabled(skPlan.canExecute);
    });

    // gear slots
    SLOTS.forEach((slot, i) => {
      const x = 330 + i * 330;
      const g = gear.find((x2) => x2.slot === slot && x2.equippedBy === this.id);
      this.card(x, 855, 310, 150, g ? 'normal' : 'dim');
      this.text(x, 808, slot.toUpperCase(), { fontSize: '22px', color: T.dim }).setOrigin(0.5);
      const label = this.text(x, 852, g ? `${g.name} (Lv ${g.level}/${g.levelCap})` : '— empty —', { fontSize: '24px', color: g ? T.text : T.dim, align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5);
      if (label.height > 58) label.setScale(58 / label.height);
      this.button(x, 926, { label: 'CHANGE', w: 200, h: 56, fontSize: 22, onClick: () => this.nav.start('Gear', { characterId: this.id, slot }) });
    });
  }

  private async act(fn: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await fn();
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
  }
}

