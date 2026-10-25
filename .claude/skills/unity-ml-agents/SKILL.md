---
name: unity-ml-agents
description: Unity ML-Agents (com.unity.ml-agents 4.1.0 + mlagents 1.1.0) for offline training, balance and playtest bots in UOMD. Use for reinforcement learning, ML-Agents setup or trained-bot questions; never ships in the game client.
---

# Unity ML-Agents in UOMD

Source: [Unity-Technologies/ml-agents](https://github.com/Unity-Technologies/ml-agents) (Apache-2.0), checked on 2026-10-25 at
commit `d84b2a2583d6b2935bc7467de35334e978f4288e`. Verified versions:

| Part | Version | Requirement |
| --- | --- | --- |
| Unity package `com.unity.ml-agents` | 4.1.0 (UPM latest, released 2026-07-27) | `unity: 6000.0`; depends on `com.unity.ai.inference` 2.6.1 and the physics module |
| Python trainer `mlagents` (PyPI) | 1.1.0 | Python `>=3.10.1,<=3.10.12`, PyTorch `>=2.1.1,<=2.8.0` |

Not yet verified here: the package on the pinned 6000.3 editor. Check the console after the first install.
Docs: [manual](https://docs.unity3d.com/Packages/com.unity.ml-agents@4.1/manual/index.html),
[installation](https://docs.unity3d.com/Packages/com.unity.ml-agents@4.1/manual/Installation.html),
[training](https://docs.unity3d.com/Packages/com.unity.ml-agents@4.1/manual/Training-ML-Agents.html).

## Project rules (binding)

1. **Not in the shipping client.** Do not add `com.unity.ml-agents` or `com.unity.ai.inference` to
   `apps/unity/Packages/manifest.json`. The Worker re-simulates every battle with `@uomd/combat`, and `Uomd.Combat` must stay a
   bit-exact port. A neural policy evaluated on the device cannot be replayed on the server, and the inference runtime adds
   size and IL2CPP risk to the AAB. Shipping any ML runtime needs an owner decision recorded in `docs/DECISIONS.md`.
2. **Where it may run**: a separate sandbox Unity project (proposed `apps/unity-ml/`, created only after the owner agrees)
   or a local throwaway project. Training output goes to `.cache/` (git-ignored); commit configs and reports, not models.
3. **What it is for**: balance and playtest bots (team-building, skill-card choices, AUTO quality), stress tests for
   content, comparison of encounter difficulty. Feed it the engine-free `Uomd.Combat` (wrap it in an `Agent`) so results
   match the real rules; never re-implement combat for training.
4. **Shipping a finding** means turning it into deterministic rules or content data, changed in TypeScript and C# together
   with regenerated vectors (`tools/export_unity_*_vectors.ts`), like any engine change.
5. Training compute and any cloud spend need owner approval; no paid jobs from this skill.

## Setup (sandbox only)

```bash
uv venv --python 3.10.12 .cache/mlagents-venv
uv pip install --python .cache/mlagents-venv mlagents==1.1.0
.cache/mlagents-venv/Scripts/mlagents-learn --help   # Windows; bin/mlagents-learn on Linux/macOS
```

In the sandbox project's `Packages/manifest.json`: `"com.unity.ml-agents": "4.1.0"`. Reference the engine-free assemblies from
`apps/unity/Assets/_UOMD/Scripts` (Contracts, Core, Combat) as a local package or copied asmdefs, not by moving them.

Train: `mlagents-learn <config>.yaml --run-id=<id> --results-dir .cache/mlagents-results`, then press Play in the sandbox
(or build a headless player). Inspect with TensorBoard from the same venv. Report the run id, config, steps and the metric
that answered the question.
