#!/usr/bin/env python3
"""INF-040: the libraries an APK records must be in the third-party notices with the same version.

Android libraries leave a record in the APK: AndroidX writes META-INF/<group>_<artifact>.version, Google's Play
libraries write <client>.properties (version=, client=). A library missing from game/data/legal/android_libraries.json
would ship without its license on the Licenses screen; tools/build_uomd_native.sh regenerates the file.

Usage: check_apk_notices.py <apk> <android_libraries.json>
"""
import json
import re
import sys
import zipfile

# Some AndroidX releases wrote their build task's name instead of a version into the file: no record to compare.
VERSION = re.compile(r"^[0-9][0-9A-Za-z.+-]*$")


def problems_in(apk: str, notices: str) -> tuple[int, list[str]]:
    with open(notices, encoding="utf-8") as handle:
        listed = {(row["group"], row["name"]): row["version"] for row in json.load(handle)["libraries"]}
    by_name: dict[str, set[str]] = {}
    for (_, name), version in listed.items():
        by_name.setdefault(name, set()).add(version)
    problems: list[str] = []
    checked = 0
    with zipfile.ZipFile(apk) as archive:
        for entry in archive.namelist():
            if entry.startswith("META-INF/") and entry.count("/") == 1 and entry.endswith(".version"):
                group, _, artifact = entry[len("META-INF/"):-len(".version")].partition("_")
                if "." not in group:
                    continue  # not a <group>_<artifact> record (e.g. kotlinx's own files)
                version = archive.read(entry).decode().strip()
                if not VERSION.match(version):
                    continue
                checked += 1
                if listed.get((group, artifact)) != version:
                    problems.append(f"{group}:{artifact} {version} (notices: {listed.get((group, artifact))})")
            elif "/" not in entry and entry.endswith(".properties"):
                lines = archive.read(entry).decode().splitlines()
                props = dict(line.split("=", 1) for line in lines if "=" in line)
                if "client" in props and "version" in props:
                    checked += 1
                    if props["version"] not in by_name.get(props["client"], set()):
                        problems.append(f"{props['client']} {props['version']} (notices: {sorted(by_name.get(props['client'], set()))})")
    return checked, problems


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    checked, problems = problems_in(sys.argv[1], sys.argv[2])
    print(f"third-party notices: {checked} recorded libraries checked")
    for problem in problems:
        print(f"  missing or different in the notices: {problem}")
    return 1 if problems or checked == 0 else 0


if __name__ == "__main__":
    sys.exit(main())
