#!/usr/bin/env python3
"""Compile every apps/unity asmdef against the real Unity Editor managed assemblies, without a Unity licence.

The Unity Linux editor archive is public. This script stream-extracts only its compile references (UnityEngine/UnityEditor
module DLLs and built-in package folders) into a cache, generates one SDK-style project per asmdef that mirrors its
references (non-transitive), and builds them with the .NET SDK under Unity's language limit (C# 9, .NET Standard 2.1).

This is a compile check, not an import: it does not run asset import, serialization, shader compilation, IL2CPP or tests
inside Unity. Assemblies that reference package code we do not compile (for example URP runtime) are reported as SKIPPED.

Usage:
  python3 apps/unity/cloud/unity_ref_compile.py [--fetch] [--editor-data DIR]
  --fetch        download/extract the pinned editor references when the cache is missing (~4.5 GB stream, ~46 MB kept)
  --editor-data  use an existing Editor/Data directory (for example a local Unity install)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[3]
UNITY = ROOT / "apps" / "unity"
ASSETS = UNITY / "Assets"
OUT = ROOT / ".cache" / "unity-ref-compile"
# Unity defines that every 6000.3 compile sees; platform defines are not used by this codebase today.
DEFINES = ["UNITY_6000_3_OR_NEWER", "UNITY_6000_2_OR_NEWER", "UNITY_6000_1_OR_NEWER", "UNITY_6000_0_OR_NEWER", "UNITY_2023_1_OR_NEWER", "UNITY_2022_3_OR_NEWER", "UNITY_2021_3_OR_NEWER", "CSHARP_7_3_OR_NEWER", "ENABLE_IL2CPP"]
# Signatures copied from URP 17.3.0 (Runtime/Data/UniversalRenderPipelineAsset.cs:716, Runtime/2D/Renderer2DData.cs:19;
# the real asset derives from RenderPipelineAsset<UniversalRenderPipeline>, the non-generic base is enough here),
# one block per URP assembly so a missing asmdef reference fails here as it does in Unity: Renderer2DData lives in
# Unity.RenderPipelines.Universal.2D.Runtime, not in Universal.Runtime.
# Lets the editor assembly's UnityEditor API usage be compiled without building URP and its Burst/Collections chain.
# Re-check against the built-in package when the editor version changes.
URP_SIGNATURES = {
    "Unity.RenderPipelines.Core.Runtime": "",
    "Unity.RenderPipelines.Universal.Runtime": """namespace UnityEngine.Rendering.Universal
{
    public abstract class ScriptableRendererData : UnityEngine.ScriptableObject { }
    public partial class UniversalRenderPipelineAsset : UnityEngine.Rendering.RenderPipelineAsset
    {
        public static UniversalRenderPipelineAsset Create(ScriptableRendererData rendererData = null) => null;
        protected override UnityEngine.Rendering.RenderPipeline CreatePipeline() => null;
    }
}
""",
    "Unity.RenderPipelines.Universal.2D.Runtime": """namespace UnityEngine.Rendering.Universal
{
    public partial class Renderer2DData : ScriptableRendererData { }
    // Reflected in the pinned Editor 6000.3.27f1 / URP 17.3; only the stage's public API surface is needed.
    public sealed class Light2D : UnityEngine.MonoBehaviour
    {
        public enum LightType { Parametric, Freeform, Sprite, Point, Global }
        public LightType lightType { get; set; }
        public UnityEngine.Color color { get; set; }
        public float intensity { get; set; }
        public float pointLightInnerRadius { get; set; }
        public float pointLightOuterRadius { get; set; }
    }
}
""",
}
URP_REFS = set(URP_SIGNATURES)
# Attribute name, public parameterless construction and Method usage verified against test-framework 1.6.0
# UnityEngine.TestRunner/NUnitExtensions/Attributes/UnityTestAttribute.cs:61-69. This does not emulate its runner;
# IEnumerator scheduling and assertions must run in the real Unity PlayMode test job.
UNITY_TEST_ATTRIBUTE_SIGNATURE = """namespace UnityEngine.TestTools {
    [System.AttributeUsage(System.AttributeTargets.Method)]
    public class UnityTestAttribute : System.Attribute { public UnityTestAttribute() { } }
}
"""
EXTRACT = [
    "Editor/Data/Managed/UnityEngine/*",
    "Editor/Data/Resources/PackageManager/BuiltInPackages/com.unity.ext.nunit/*",
    "Editor/Data/Resources/PackageManager/BuiltInPackages/*/package.json",
]


def editor_version() -> tuple[str, str]:
    text = (UNITY / "ProjectSettings" / "ProjectVersion.txt").read_text()
    match = re.search(r"m_EditorVersionWithRevision:\s*(\S+)\s*\((\w+)\)", text)
    if not match:
        sys.exit("ProjectVersion.txt has no m_EditorVersionWithRevision")
    return match.group(1), match.group(2)


def fetch(dest: Path, version: str, changeset: str) -> None:
    url = f"https://download.unity3d.com/download_unity/{changeset}/LinuxEditorInstaller/Unity-{version}.tar.xz"
    dest.mkdir(parents=True, exist_ok=True)
    print(f"Streaming compile references from {url}")
    curl = subprocess.Popen(["curl", "-fsSL", "--retry", "3", url], stdout=subprocess.PIPE)
    tar = subprocess.run(["tar", "-xJ", "-C", str(dest), "--wildcards", *EXTRACT], stdin=curl.stdout)
    curl.stdout.close()  # type: ignore[union-attr]
    if curl.wait() != 0 or tar.returncode != 0:
        sys.exit("Downloading or extracting the Unity editor archive failed")


def manifest_errors(data: Path) -> list[str]:
    """Packages the editor bundles (URP, ugui, test-framework, ...) resolve only at the bundled version."""
    builtins = data / "Resources" / "PackageManager" / "BuiltInPackages"
    deps = json.loads((UNITY / "Packages" / "manifest.json").read_text())["dependencies"]
    errors = []
    for name, wanted in deps.items():
        meta = builtins / name / "package.json"
        if name.startswith("com.unity.modules.") or not meta.is_file():
            continue
        bundled = json.loads(meta.read_text())["version"]
        if wanted != bundled:
            errors.append(f"Packages/manifest.json: {name}@{wanted} but this editor bundles {bundled}")
    return errors


def enabled_packages(data: Path) -> set[str]:
    """Every package the project resolves: Packages/packages-lock.json when Unity has written it, otherwise the manifest
    plus the transitive dependencies of the editor's built-in packages."""
    lock = UNITY / "Packages" / "packages-lock.json"
    if lock.is_file():
        return set(json.loads(lock.read_text())["dependencies"])
    builtins = data / "Resources" / "PackageManager" / "BuiltInPackages"
    todo = list(json.loads((UNITY / "Packages" / "manifest.json").read_text())["dependencies"])
    seen: set[str] = set()
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        meta = builtins / name / "package.json"
        if meta.is_file():
            todo.extend(json.loads(meta.read_text()).get("dependencies", {}))
    return seen


def engine_modules(managed: Path, data: Path) -> list[Path]:
    """UnityEngine module DLLs the project can see. A module that ships as an optional built-in package
    (UnityEngine.AndroidJNIModule.dll <-> com.unity.modules.androidjni) is visible only when that package is enabled;
    Unity reports its types as CS1069 otherwise. Modules without a package (Core, TextRendering, ...) are always on."""
    builtins = data / "Resources" / "PackageManager" / "BuiltInPackages"
    optional = {p.name.removeprefix("com.unity.modules.") for p in builtins.glob("com.unity.modules.*")}
    enabled = {n.removeprefix("com.unity.modules.") for n in enabled_packages(data) if n.startswith("com.unity.modules.")}
    keep = []
    for dll in sorted(managed.glob("UnityEngine*.dll")):
        match = re.fullmatch(r"UnityEngine\.(\w+)Module", dll.stem)
        module = match.group(1).lower() if match else None
        if module is None or module not in optional or module in enabled:
            keep.append(dll)
    return keep


def own_sources(asmdef: Path, all_asmdefs: list[Path]) -> list[Path]:
    folder = asmdef.parent
    nested = [a.parent for a in all_asmdefs if a != asmdef and folder in a.parents]
    return sorted(p for p in folder.rglob("*.cs") if not any(n in p.parents for n in nested))


def project(name: str, sources: list[Path], uomd_refs: list[str], dlls: list[Path], defines: list[str]) -> str:
    items = "\n".join(f'    <Compile Include="{escape(str(s))}" />' for s in sources)
    refs = "\n".join(f'    <ProjectReference Include="../{r}/{r}.csproj" />' for r in uomd_refs)
    hints = "\n".join(f'    <Reference Include="{escape(d.stem)}"><HintPath>{escape(str(d))}</HintPath><Private>false</Private></Reference>' for d in dlls)
    return f"""<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.1</TargetFramework>
    <AssemblyName>{name}</AssemblyName>
    <LangVersion>9.0</LangVersion>
    <Nullable>disable</Nullable>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <DisableTransitiveProjectReferences>true</DisableTransitiveProjectReferences>
    <DefineConstants>{';'.join(defines)}</DefineConstants>
    <NoWarn>CS0618;CS0414;CS0649;CS0169</NoWarn>
  </PropertyGroup>
  <ItemGroup>
{items}
  </ItemGroup>
  <ItemGroup>
{refs}
  </ItemGroup>
  <ItemGroup>
{hints}
  </ItemGroup>
</Project>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--editor-data", type=Path)
    parser.add_argument("--player-only", action="store_true", help="Compile player assemblies without UNITY_EDITOR or test assemblies")
    args = parser.parse_args()

    version, changeset = editor_version()
    data = args.editor_data or Path(os.environ.get("UOMD_UNITY_REF_CACHE", Path.home() / ".cache" / "uomd-unity-ref")) / version / "Editor" / "Data"
    managed = data / "Managed" / "UnityEngine"
    if not managed.is_dir():
        if not args.fetch:
            sys.exit(f"No Unity references at {managed}; rerun with --fetch or --editor-data")
        fetch(data.parents[1], version, changeset)
    engine = engine_modules(managed, data)
    editor = sorted(p for p in managed.glob("UnityEditor*.dll"))
    nunit = next((data / "Resources" / "PackageManager" / "BuiltInPackages" / "com.unity.ext.nunit").rglob("nunit.framework.dll"), None)

    asmdefs = sorted(ASSETS.rglob("*.asmdef"))
    defs = {json.loads(a.read_text())["name"]: a for a in asmdefs}
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)
    built, skipped, stubbed = [], {}, []
    for name, path in defs.items():
        spec = json.loads(path.read_text())
        is_editor = spec.get("includePlatforms") == ["Editor"]
        if args.player_only and (is_editor or "UNITY_INCLUDE_TESTS" in spec.get("defineConstraints", [])):
            continue
        refs = spec.get("references", [])
        uomd = [r for r in refs if r in defs]
        test_runner = {"UnityEngine.TestRunner", "UnityEditor.TestRunner"}
        foreign = [r for r in refs if r not in defs and r not in test_runner and r not in URP_REFS]
        if foreign:
            skipped[name] = "references package assemblies not compiled here: " + ", ".join(foreign)
            continue
        # Runtime assemblies also see UNITY_EDITOR while imported in the Editor. Editor tools may depend on those
        # guarded typed entry points; --player-only separately proves their exclusion from a shipping compilation.
        dlls = engine + ([] if args.player_only else editor)
        if "nunit.framework.dll" in spec.get("precompiledReferences", []) and nunit:
            dlls.append(nunit)
        defines = DEFINES + ([] if args.player_only else ["UNITY_EDITOR"]) + spec.get("defineConstraints", [])
        folder = OUT / name
        folder.mkdir()
        sources = own_sources(path, asmdefs)
        if "UnityEngine.TestRunner" in refs:
            (folder / "UnityTestAttributeSignature.cs").write_text(UNITY_TEST_ATTRIBUTE_SIGNATURE)
            sources.append(folder / "UnityTestAttributeSignature.cs")
        if URP_REFS & set(refs):
            (folder / "UrpSignatures.cs").write_text("".join(URP_SIGNATURES[r] for r in sorted(URP_REFS & set(refs))))
            sources.append(folder / "UrpSignatures.cs")
            stubbed.append(name)
        (folder / f"{name}.csproj").write_text(project(name, sources, uomd, dlls, defines))
        built.append(name)

    # Projects referencing a skipped assembly cannot build either.
    for name in list(built):
        missing = [r for r in json.loads(defs[name].read_text()).get("references", []) if r in skipped]
        if missing:
            built.remove(name)
            skipped[name] = "depends on skipped " + ", ".join(missing)
            shutil.rmtree(OUT / name)

    subprocess.run(["dotnet", "new", "sln", "-n", "UnityRefCompile", "--format", "sln", "-o", str(OUT)], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["dotnet", "sln", str(OUT / "UnityRefCompile.sln"), "add", *[str(OUT / n / f"{n}.csproj") for n in built]], check=True, stdout=subprocess.DEVNULL)
    env = {**os.environ, "MSBUILDDISABLENODEREUSE": "1", "DOTNET_CLI_TELEMETRY_OPTOUT": "1", "DOTNET_NOLOGO": "1"}
    result = subprocess.run(["dotnet", "build", str(OUT / "UnityRefCompile.sln"), "-nodeReuse:false", "-v", "quiet", "-clp:NoSummary"], env=env, capture_output=True, text=True)
    errors = manifest_errors(data) + sorted({line.strip().replace(str(ROOT) + "/", "") for line in result.stdout.splitlines() if ": error " in line})
    for line in errors:
        print(line)
    print(f"\nUnity {version} reference compile: {len(built)} assemblies built from source, {len(errors)} errors")
    for name in stubbed:
        print(f"NOTE {name}: URP types come from verified 17.3.0 signatures, not the compiled package")
    for name, why in skipped.items():
        print(f"SKIPPED {name}: {why}")
    return 1 if result.returncode != 0 or errors else 0


if __name__ == "__main__":
    sys.exit(main())
