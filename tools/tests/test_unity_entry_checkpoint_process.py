"""Cross-process persistence/atomic-promotion checks using the actual engine-free Unity checkpoint source."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[2]
PROGRAM = r'''
using System;
using System.Collections.Generic;
using System.IO;
using Uomd.Core;
string mode = args[0], root = args[1];
string scope = UomdEntryCheckpoint.ScopeFor(mode == "other" ? "player:process-b" : "player:process-a");
var store = new UomdEntryCheckpointStore(root);
if (mode == "write") store.Save(new UomdEntryCheckpoint {
    Scope = scope, Release = "rel_0001", Phase = "pre_story", PrologueDone = true, Tutorials = 1,
    Stage = 2, StoryPath = "story/tutorial_t2_before.json", SceneId = "tutorial_t2_before",
    ContentHash = new string('a', 64), StoryIndex = 3, Sequence = 7, AutoRead = false
});
if (mode == "advance") { var c = store.Load(scope); c.Sequence = 8; c.StoryIndex = 4; store.Save(c); }
if (mode == "interrupted") {
    File.WriteAllText(Path.Combine(root, scope + ".json.tmp"), "unpromoted interrupted fixture");
    Environment.Exit(17); // Abrupt process exit before promotion; next launch must ignore the temp file.
}
if (mode == "corrupt") File.WriteAllText(Path.Combine(root, scope + ".json"), "damaged latest fixture");
var record = store.Load(scope);
Console.WriteLine(CanonicalJson.Serialize(new Dictionary<string, object?> {
    ["record"] = UomdJson.Parse(record.Encode()), ["issue"] = store.ReadIssue
}));
'''


class EntryCheckpointProcessTests(unittest.TestCase):
    def test_separate_processes_restore_ignore_unpromoted_data_recover_backup_and_isolate_accounts(self):
        cache = (ROOT / ".cache").resolve()
        cache.mkdir(exist_ok=True)
        fixture = tempfile.TemporaryDirectory(prefix="entry-process-", dir=cache)
        # Verify the absolute cleanup target before TemporaryDirectory performs recursive cleanup on Windows.
        fixture_root = Path(fixture.name).resolve()
        self.assertTrue(fixture_root.is_relative_to(cache))
        self.assertNotEqual(fixture_root, cache)
        try:
            core = ROOT / "apps/unity/Logic/Uomd.Core/Uomd.Core.csproj"
            (fixture_root / "Probe.csproj").write_text(
                '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType>'
                '<TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable></PropertyGroup>'
                '<ItemGroup><ProjectReference Include="' + escape(str(core), {'"': '&quot;'}) + '" />'
                '</ItemGroup></Project>', encoding="utf-8"
            )
            (fixture_root / "Program.cs").write_text(PROGRAM, encoding="utf-8")
            env = dict(os.environ, DOTNET_CLI_TELEMETRY_OPTOUT="1", DOTNET_NOLOGO="1")
            built = subprocess.run(
                ["dotnet", "build", str(fixture_root / "Probe.csproj"), "-c", "Release", "-nodeReuse:false", "--nologo", "-v", "quiet"],
                cwd=ROOT, env=env, capture_output=True, text=True, timeout=120
            )
            self.assertEqual(built.returncode, 0, (built.stdout + built.stderr)[-5000:])
            dll = fixture_root / "bin/Release/net10.0/Probe.dll"
            data = fixture_root / "data"

            def launch(mode, expected=0):
                result = subprocess.run(["dotnet", str(dll), mode, str(data)], cwd=ROOT, env=env,
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, expected, (result.stdout + result.stderr)[-5000:])
                return json.loads(result.stdout) if result.stdout.strip() else None

            first = launch("write")["record"]
            self.assertEqual(launch("read")["record"], first)
            launch("interrupted", expected=17)
            self.assertEqual(launch("read")["record"], first)
            self.assertEqual(launch("advance")["record"]["sequence"], 8)
            recovered = launch("corrupt")
            self.assertEqual(recovered["record"], first)
            self.assertIn("Recovered", recovered["issue"])
            other = launch("other")["record"]
            self.assertFalse(other["prologue"])
            self.assertEqual(other["tutorials"], 0)
            self.assertNotEqual(first["scope"], other["scope"])
        finally:
            fixture.cleanup()


if __name__ == "__main__":
    unittest.main()
