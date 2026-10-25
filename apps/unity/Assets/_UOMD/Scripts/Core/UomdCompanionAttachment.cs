#nullable enable
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Uomd.Core
{
    /// <summary>
    /// Bond and tactical badges of a companion (port of apps/game/src/ui/pilotAttachment.ts describeCompanionAttachment,
    /// R15). The texts are the TS client's; unknown companions get the generic company bond.
    /// </summary>
    public sealed class UomdCompanionAttachment
    {
        public string CharacterId = "";
        public bool IsPilotAnchor;
        public string BondTitle = "", BondLine = "", TacticalBadge = "", FormationSlot = "", CostumeNote = "";
        public string[] Expressions = Array.Empty<string>();

        private static readonly Dictionary<string, UomdCompanionAttachment> Known = new Dictionary<string, UomdCompanionAttachment>(StringComparer.Ordinal)
        {
            ["fadyme"] = new UomdCompanionAttachment
            {
                IsPilotAnchor = true, BondTitle = "Bond · Mahmut (Unspoken Watch)",
                BondLine = "Trusts Mahmut’s battered heater shield before her own House Veyr bell.",
                TacticalBadge = "Backline Veil Support-DPS · Bell Resonance", FormationSlot = "backline",
                Expressions = new[] { "composed", "dry_amusement", "soft_smile", "determined" },
                CostumeNote = "Raised plum pilgrim hood · broken silver crown clasp · white scarf"
            },
            ["mahmut"] = new UomdCompanionAttachment
            {
                IsPilotAnchor = true, BondTitle = "Bond · Fadyme (Oathless Guard)",
                BondLine = "Hammered the royal crest from his breastplate; guards Fadyme across every road.",
                TacticalBadge = "Frontline Stone Tank-Bruiser · Vanguard Wall", FormationSlot = "frontline",
                Expressions = new[] { "composed", "watchful", "protective", "dry_humor" },
                CostumeNote = "Village-repaired Guard half-plate · empty crown socket · tattered oxblood cloak"
            },
            ["iona"] = new UomdCompanionAttachment
            {
                BondTitle = "Bond · First Oath Ledger Keeper", BondLine = "Keeps the unclosed names of the river parishes in dry ink.",
                TacticalBadge = "Backline Dawn Healer-Support · Witness Ward", FormationSlot = "backline",
                Expressions = new[] { "composed", "determined" }, CostumeNote = "Chapel-grey travel coat · brass ink-horn · linen stole"
            },
            ["yseldra"] = new UomdCompanionAttachment
            {
                BondTitle = "Bond · Seal of the Border Watch", BondLine = "Pressed her wax seal into the rim of Mahmut’s shield on the night of departure.",
                TacticalBadge = "Frontline Ember Bruiser · Sealbreaker", FormationSlot = "frontline",
                Expressions = new[] { "composed", "determined" }, CostumeNote = "Charred surcoat · wax-sealed shoulder guard"
            },
            ["marek"] = new UomdCompanionAttachment
            {
                BondTitle = "Bond · Remnant of the Old Guard", BondLine = "Recognizes the hammered-empty socket above the star on Mahmut’s breastplate.",
                TacticalBadge = "Frontline Stone Defender · Halberd Line", FormationSlot = "frontline",
                Expressions = new[] { "composed", "watchful" }, CostumeNote = "Weathered brigade brigandine · notched polearm"
            }
        };

        private static readonly Regex Front = new Regex("tank|bruiser|vanguard|defender", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        public static UomdCompanionAttachment Describe(string characterId, string element = "Veil", string role = "specialist")
        {
            if (Known.TryGetValue(characterId, out var known))
            {
                return new UomdCompanionAttachment
                {
                    CharacterId = characterId, IsPilotAnchor = known.IsPilotAnchor, BondTitle = known.BondTitle, BondLine = known.BondLine,
                    TacticalBadge = known.TacticalBadge, FormationSlot = known.FormationSlot, Expressions = known.Expressions, CostumeNote = known.CostumeNote
                };
            }
            string cleanRole = (role ?? "").Replace('_', ' ');
            bool isFront = Front.IsMatch(cleanRole);
            return new UomdCompanionAttachment
            {
                CharacterId = characterId,
                BondTitle = "Bond · Company of the Unclosed Hours",
                BondLine = "Travels under the road truce alongside Fadyme and Mahmut.",
                TacticalBadge = $"{(isFront ? "Frontline" : "Backline")} {element} {cleanRole}",
                FormationSlot = isFront ? "frontline" : "backline",
                Expressions = new[] { "composed" },
                CostumeNote = "Road-worn company attire"
            };
        }

        /// <summary>The next portrait expression in the companion's set (cycles).</summary>
        public static string NextExpression(string characterId, string current)
        {
            var list = Describe(characterId).Expressions;
            if (list.Length == 0) return "composed";
            int idx = Array.IndexOf(list, current);
            return list[(idx + 1) % list.Length];
        }
    }
}
