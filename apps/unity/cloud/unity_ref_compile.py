#!/usr/bin/env python3
"""Compile every apps/unity asmdef against the real Unity Editor managed assemblies, without a Unity licence.

The Unity Linux editor archive is public. This script stream-extracts only its compile references (UnityEngine/UnityEditor
module DLLs and built-in package folders) into a cache, generates one SDK-style project per asmdef that mirrors its
references (non-transitive), and builds them with the .NET SDK under Unity's language limit (C# 9, .NET Standard 2.1).

This is a compile check, not an import: it does not run asset import, serialization, shader compilation, IL2CPP or tests
inside Unity. Assemblies that reference package code we do not compile (for example URP runtime) are reported as SKIPPED.

Usage:
  python3 apps/unity/cloud/unity_ref_compile.py [--fetch] [--editor-data DIR]
  --fetch        download/extract the pinned editor references when the cache is missing (~4.5 GB stream, ~2 GB kept)
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
# Unity defines that every 6000.0 compile sees; platform defines are not used by this codebase today.
DEFINES = ["UNITY_6000_0_OR_NEWER", "UNITY_2023_1_OR_NEWER", "UNITY_2022_3_OR_NEWER", "UNITY_2021_3_OR_NEWER", "CSHARP_7_3_OR_NEWER", "ENABLE_IL2CPP"]
# Signatures copied from URP 17.0.4 (Runtime/Data/UniversalRenderPipelineAsset.cs:678, Runtime/2D/Renderer2DData.cs:19).
# Lets the editor assembly's UnityEditor API usage be compiled without building URP and its Burst/Collections chain.
# Re-check against the built-in package when the editor version changes.
URP_SIGNATURES = """namespace UnityEngine.Rendering.Universal
{
    public abstract class ScriptableRendererData : UnityEngine.ScriptableObject { }
    public partial class Renderer2DData : ScriptableRendererData { }
    public partial class UniversalRenderPipelineAsset : UnityEngine.Rendering.RenderPipelineAsset
    {
        public static UniversalRenderPipelineAsset Create(ScriptableRendererData rendererData = null) => null;
        protected override UnityEngine.Rendering.RenderPipeline CreatePipeline() => null;
    }
}
"""
URP_REFS = {"Unity.RenderPipelines.Core.Runtime", "Unity.RenderPipelines.Universal.Runtime"}
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
    args = parser.parse_args()

    version, changeset = editor_version()
    data = args.editor_data or Path(os.environ.get("UOMD_UNITY_REF_CACHE", Path.home() / ".cache" / "uomd-unity-ref")) / version / "Editor" / "Data"
    managed = data / "Managed" / "UnityEngine"
    if not managed.is_dir():
        if not args.fetch:
            sys.exit(f"No Unity references at {managed}; rerun with --fetch or --editor-data")
        fetch(data.parents[1], version, changeset)
    engine = sorted(p for p in managed.glob("UnityEngine*.dll"))
    editor = sorted(p for p in managed.glob("UnityEditor*.dll"))
    nunit = next((data / "Resources" / "PackageManager" / "BuiltInPackages" / "com.unity.ext.nunit").rglob("nunit.framework.dll"), None)

    asmdefs = sorted(ASSETS.rglob("*.asmdef"))
    defs = {json.loads(a.read_text())["name"]: a for a in asmdefs}
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)
    built, skipped, stubbed = [], {}, []
    for name, path in defs.items():
        spec = json.loads(path.read_text())
        refs = spec.get("references", [])
        uomd = [r for r in refs if r in defs]
        test_runner = {"UnityEngine.TestRunner", "UnityEditor.TestRunner"}
        foreign = [r for r in refs if r not in defs and r not in test_runner and r not in URP_REFS]
        if foreign:
            skipped[name] = "references package assemblies not compiled here: " + ", ".join(foreign)
            continue
        is_editor = spec.get("includePlatforms") == ["Editor"]
        dlls = engine + (editor if is_editor else [])
        if "nunit.framework.dll" in spec.get("precompiledReferences", []) and nunit:
            dlls.append(nunit)
        defines = DEFINES + (["UNITY_EDITOR"] if is_editor else []) + spec.get("defineConstraints", [])
        folder = OUT / name
        folder.mkdir()
        sources = own_sources(path, asmdefs)
        if URP_REFS & set(refs):
            (folder / "UrpSignatures.cs").write_text(URP_SIGNATURES)
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
        print(f"NOTE {name}: URP types come from verified 17.0.4 signatures, not the compiled package")
    for name, why in skipped.items():
        print(f"SKIPPED {name}: {why}")
    return 1 if result.returncode != 0 or errors else 0


if __name__ == "__main__":
    sys.exit(main())
