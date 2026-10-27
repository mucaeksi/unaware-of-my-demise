"""Real C# journal across separate processes, including an exit before atomic promotion."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
PROGRAM = r'''
using System;
using System.IO;
using Uomd.Core;
using Uomd.Contracts;
string mode = args[0], root = args[1];
string scope = UomdBattleOperation.ScopeFor(mode == "other" ? "player:process-b" : "player:process-a");
var store = new UomdBattleJournal(root);
if (mode == "write") {
    var fixture = UomdJson.ParseObject(File.ReadAllText(args[2]));
    var submit = fixture["submit"];
    var operation = new UomdBattleOperation { Scope = scope, Release = JsonRead.Str(submit, "releaseId"), Node = JsonRead.Str(submit, "nodeId"),
        Encounter = "stage_1_2", RequestId = JsonRead.Str(submit, "requestId"), StartJson = CanonicalJson.Serialize(fixture["start"]),
        PackHash = new string('a', 64), EncounterHash = new string('b', 64) };
    var actions = new System.Collections.Generic.List<BattleActionInputDto>();
    foreach (var a in JsonRead.Objects(submit, "actions")) actions.Add(new BattleActionInputDto { skillId = JsonRead.Str(a, "skillId"), targetId = JsonRead.Get(a, "targetId") as string });
    operation.Prepare(actions.ToArray()); store.Save(operation);
}
if (mode == "interrupted") { File.WriteAllText(Path.Combine(root, scope + ".json.tmp"), "unfinished fixture"); Environment.Exit(17); }
var saved = store.Load(scope);
Console.WriteLine(saved == null ? "null" : saved.Encode());
'''


class BattleJournalProcessTests(unittest.TestCase):
    def test_same_payload_survives_process_restart_and_account_isolation(self):
        cache = (ROOT / ".cache").resolve()
        with tempfile.TemporaryDirectory(prefix="battle-process-", dir=cache) as directory:
            work = Path(directory).resolve()
            self.assertTrue(work.is_relative_to(cache))
            self.assertNotEqual(work, cache)
            core = ROOT / "apps/unity/Logic/Uomd.Core/Uomd.Core.csproj"
            (work / "Probe.csproj").write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable></PropertyGroup><ItemGroup><ProjectReference Include="' + escape(str(core), {'"': '&quot;'}) + '" /></ItemGroup></Project>', encoding="utf-8")
            (work / "Program.cs").write_text(PROGRAM, encoding="utf-8")
            built = subprocess.run(["dotnet", "build", str(work / "Probe.csproj"), "-c", "Release", "-nodeReuse:false", "--nologo", "-v", "quiet"], cwd=ROOT, capture_output=True, text=True, timeout=120)
            self.assertEqual(0, built.returncode, (built.stdout + built.stderr)[-5000:])
            fixture = ROOT / "apps/unity/Assets/_UOMD/Tests/EditMode/battle_contract_vectors.json"

            def run(mode, expected=0):
                result = subprocess.run(["dotnet", str(work / "bin/Release/net10.0/Probe.dll"), mode, str(work / "data"), str(fixture)], cwd=ROOT, capture_output=True, text=True, timeout=30)
                self.assertEqual(expected, result.returncode, (result.stdout + result.stderr)[-5000:])
                return json.loads(result.stdout) if result.stdout.strip() else None

            first = run("write")
            self.assertEqual("pending", first["state"])
            self.assertEqual(first, run("read"))
            run("interrupted", 17)
            self.assertEqual(first, run("read"))
            self.assertIsNone(run("other"))


if __name__ == "__main__":
    unittest.main()
