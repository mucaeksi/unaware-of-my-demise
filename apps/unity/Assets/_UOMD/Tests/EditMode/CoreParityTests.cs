#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Tests
{
    /// <summary>
    /// Golden vectors produced by tools/export_unity_parity_vectors.ts from the authoritative TypeScript packages.
    /// Regenerate with `npx tsx tools/export_unity_parity_vectors.ts` whenever those packages change.
    /// </summary>
    public sealed class CoreParityTests
    {
        private static Dictionary<string, object?>? _vectors;

        private static Dictionary<string, object?> Vectors
        {
            get
            {
                if (_vectors == null)
                {
                    string path = Path.Combine(Application.dataPath, "_UOMD/Tests/EditMode/parity_vectors.json");
                    _vectors = UomdJson.ParseObject(File.ReadAllText(path));
                }
                return _vectors;
            }
        }

        private static List<object?> Section(string name) => (List<object?>)Vectors[name]!;
        private static Dictionary<string, object?> Obj(object? o) => (Dictionary<string, object?>)o!;
        private static double Num(object? o) => Convert.ToDouble(o, CultureInfo.InvariantCulture);
        private static int Int(object? o) => Convert.ToInt32(o, CultureInfo.InvariantCulture);

        [Test]
        public void Mulberry32MatchesTypeScript()
        {
            foreach (object? item in Section("rng"))
            {
                var v = Obj(item);
                var rng = new Mulberry32Rng(Convert.ToInt64(v["seed"], CultureInfo.InvariantCulture));
                foreach (object? expected in (List<object?>)v["values"]!)
                {
                    Assert.AreEqual(Num(expected), rng.Next(), 0.0);
                }
                Assert.AreEqual(Convert.ToUInt32(v["snapshot"], CultureInfo.InvariantCulture), rng.Snapshot());
            }
        }

        [Test]
        public void StatMathMatchesTypeScript()
        {
            foreach (object? item in Section("stats"))
            {
                var v = Obj(item);
                var block = Obj(v["block"]);
                var b = Obj(block["base"]);
                var g = Obj(block["growth"]);
                var bonus = Obj(v["bonus"]);
                string power = (string)block["power"]!;
                double Bonus(string k) => bonus.TryGetValue(k, out var x) ? Num(x) : 0;

                AttributeValues a = UomdStatMath.AttributesAt(
                    power,
                    Num(b["str"]), Num(b["int"]), Num(b["vit"]), Num(b["agi"]),
                    Num(g["str"]), Num(g["int"]), Num(g["vit"]), Num(g["agi"]),
                    Int(v["level"]),
                    Bonus("str"), Bonus("int"), Bonus("vit"), Bonus("agi"), Bonus("power"));

                var ea = Obj(v["attributes"]);
                Assert.AreEqual(Int(ea["str"]), a.Str);
                Assert.AreEqual(Int(ea["int"]), a.Int);
                Assert.AreEqual(Int(ea["vit"]), a.Vit);
                Assert.AreEqual(Int(ea["agi"]), a.Agi);

                int naturalArmor = block.TryGetValue("armor", out var armor) ? Int(armor) : 0;
                DerivedCombatStats d = UomdStatMath.DeriveStats(power, a, naturalArmor, Num(v["armor"]));
                var ed = Obj(v["derived"]);
                Assert.AreEqual(Int(ed["hp"]), d.Hp);
                Assert.AreEqual(Int(ed["atk"]), d.Atk);
                Assert.AreEqual(Int(ed["def"]), d.Def);
                Assert.AreEqual(Int(ed["spd"]), d.Spd);
                Assert.AreEqual(Num(ed["crit_rate"]), d.CritRate, 0.0);
                Assert.AreEqual(Num(ed["crit_damage"]), d.CritDamage, 0.0);
                Assert.AreEqual(Num(ed["effect_hit"]), d.EffectHit, 0.0);
            }
        }

        [Test]
        public void VictoryStarsMatchTypeScript()
        {
            foreach (object? item in Section("stars"))
            {
                var v = Obj(item);
                Assert.AreEqual(Int(v["stars"]), UomdStatMath.ComputeVictoryStars(Int(v["players"]), Int(v["defeated"])));
            }
        }

        [Test]
        public void CanonicalJsonMatchesTypeScript()
        {
            foreach (object? item in Section("canonical"))
            {
                var v = Obj(item);
                object? parsed = UomdJson.Parse((string)v["input"]!);
                Assert.AreEqual((string)v["canonical"]!, CanonicalJson.Serialize(parsed));
            }
        }

        [Test]
        public void NumberFormattingMatchesJavaScript()
        {
            foreach (object? item in Section("numbers"))
            {
                var v = Obj(item);
                double d = BitConverter.Int64BitsToDouble(long.Parse((string)v["bits"]!, CultureInfo.InvariantCulture));
                Assert.AreEqual((string)v["text"]!, CanonicalJson.FormatJsNumber(d));
            }
        }

        [Test]
        public void ManagedEs256VerifiesWebCryptoSignature()
        {
            var sig = Obj(Vectors["signature"]);
            var keys = new[] { new TrustKeyJwk((string)sig["kid"]!, "EC", "P-256", (string)sig["x"]!, (string)sig["y"]!) };
            var payload = UomdJson.ParseObject((string)sig["signed_json"]!);
            var envelope = Obj(payload["signature"]);
            var es = new Es256SignatureEnvelope((string)envelope["kid"]!, (string)envelope["alg"]!, (string)envelope["value"]!);

            Assert.IsTrue(Es256SignatureVerifier.VerifyPayload(payload, es, keys), "valid signature rejected");

            Obj(payload["release"])["generation"] = 4L;
            Assert.IsFalse(Es256SignatureVerifier.VerifyPayload(payload, es, keys), "tampered payload accepted");
            Assert.IsFalse(Es256SignatureVerifier.VerifyPayload(payload, es), "untrusted key accepted");
        }

        [Test]
        public void BaseBundleWasExported()
        {
            string release = Path.Combine(Application.streamingAssetsPath, "uomd_base/release.json");
            Assert.IsTrue(File.Exists(release), "Run `npm run export:unity` before opening the project.");
            var manifest = UomdJson.ParseObject(File.ReadAllText(release));
            foreach (object? f in (List<object?>)manifest["files"]!)
            {
                string rel = (string)Obj(f)["path"]!;
                Assert.IsTrue(File.Exists(Path.Combine(Application.streamingAssetsPath, "uomd_base", rel)), rel);
            }
        }
    }
}
