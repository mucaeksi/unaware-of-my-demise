#nullable enable
using System;
using System.Collections.Generic;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed class TeamScreen : RebuildCompanyScreen
    {
        public TeamScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Team;
    }
    public sealed class ArmoryScreen : RebuildCompanyScreen
    {
        public ArmoryScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Gear;
        private static readonly Dictionary<string, string> StatName = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["str"] = "STR", ["int"] = "INT", ["vit"] = "VIT", ["agi"] = "AGI", ["power"] = "POWER", ["def"] = "DEF", ["hp"] = "HP", ["atk"] = "ATK",
            ["spd"] = "SPD", ["heal_bonus"] = "HEAL", ["focus_gain"] = "FOCUS", ["effect_res"] = "EFFECT RES", ["element_res"] = "ELEMENT RES"
        };
        public static string GearStat(string id, double value)
        {
            var m = System.Text.RegularExpressions.Regex.Match(id, "^(.+)_(flat|pct)$");
            string name = m.Success && StatName.TryGetValue(m.Groups[1].Value, out string n) ? n : id.ToUpperInvariant();
            var inv = System.Globalization.CultureInfo.InvariantCulture;
            if (m.Success && m.Groups[2].Value == "pct") return $"{name} +{(Math.Round(value * 1000) / 10).ToString(inv)}%";
            return $"+{(Math.Round(value * 10) / 10).ToString(inv)} {name}";
        }

    }
}
