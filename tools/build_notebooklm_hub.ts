#!/usr/bin/env node
/**
 * Builds the organized 6-part NotebookLM Plus Knowledge Hub in `docs/notebooklm/`
 * and automatically syncs it (along with canonical character/Chibi reference templates)
 * to the user's Google Drive root folder (`../UOMD_NotebookLM_Hub`) when present.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_HUB = join(ROOT, 'docs', 'notebooklm');
const DRIVE_PARENT = resolve(ROOT, '..');
const DRIVE_HUB = join(DRIVE_PARENT, 'UOMD_NotebookLM_Hub');

function safeRead(relPath: string): string {
  const full = join(ROOT, relPath);
  return existsSync(full) ? readFileSync(full, 'utf8') : `<!-- ${relPath} not found -->`;
}

export function buildNotebookLmHub(): {
  docsHubDir: string;
  driveHubDir: string | null;
  files: string[];
} {
  mkdirSync(DOCS_HUB, { recursive: true });

  const prologueRaw = safeRead('content/base/entry/prologue.json');
  const t1Before = safeRead('content/base/story/tutorial_t1_before.json');
  const t1After = safeRead('content/base/story/tutorial_t1_after.json');
  const t2Before = safeRead('content/base/story/tutorial_t2_before.json');
  const t2After = safeRead('content/base/story/tutorial_t2_after.json');
  const t3Before = safeRead('content/base/story/tutorial_t3_before.json');
  const t3After = safeRead('content/base/story/tutorial_t3_after.json');
  const artManifest = safeRead('content/base/art/art_manifest.json');

  const filesMap: Record<string, string> = {
    '01_Master_Roadmap_and_Step_Status.md': `# 01 — Unaware of My Demise: Master Gacha Transformation Roadmap & Step Status

## 1. Executive Summary & Base AAB vs. Patch Boundary
- **Genre & Platform:** Dark Gothic Anime 5v5 Tactical Turn-Based Gacha RPG built on **Phaser 4 (v4.0.0-rc.7)** + **Capacitor Android/iOS** + **Cloudflare Workers / D1 / R2 LiveOps**.
- **Base AAB Scope (< 150 MB Google Play Asset Delivery ceiling):**
  1. **SplashScene:** Phaser 4 emblem reveal.
  2. **StudioScene:** SovTaym Studios bespoke dark-gothic celestial astrolabe mark (\`ui_studio_mark.webp\`) with rotating filigree rings and ember particles.
  3. **TitleScene:** Full-screen 16:9 dark gothic anime key art (\`ui_title_bg.webp\`) featuring canonical Fadyme & Mahmut, atmospheric ash drift, and a single breathing \`TAP TO CONTINUE\` prompt (no cluttered menu buttons).
  4. **Background Patch Start:** The moment the player taps \`TAP TO CONTINUE\`, \`Services.patches.start()\` begins downloading and verifying the signed Ed25519 LiveOps patch manifest (\`manifest.sig\`) in the background while the player experiences the opening sequence.
  5. **PrologueScene (120s "Before the Road"):** 9 bespoke 16:9 dark gothic anime cinematic plates (\`still_prologue_*\`) with clean typography and zero scene-number clutter.
  6. **3-Part Tutorial (\`T-1\`, \`T-2\`, \`T-3\`) & 6 Cutscenes:**
     - \`tutorial_t1_before\` $\\rightarrow$ Battle \`T-1: The First Step\` $\\rightarrow$ \`tutorial_t1_after\`
     - \`tutorial_t2_before\` $\\rightarrow$ Battle \`T-2: A Road Forgotten\` $\\rightarrow$ \`tutorial_t2_after\` (with full-screen event CG \`still_roadside_rest.webp\`)
     - \`tutorial_t3_before\` $\\rightarrow$ Battle \`T-3: A Roof Before Dawn\` $\\rightarrow$ \`tutorial_t3_after\` (with full-screen event CG \`still_shelter_evening.webp\`)
  7. **FinishScene ("The Road Opens"):** Confirms background patch completion and presents the explicit \`RESTART & ENTER GAME\` button, which saves the server entry checkpoint and restarts the client into the full patched gacha game (\`HomeScene\` / Sanctum Hub).

## 2. Six-Step Transformation Roadmap
- **Adım 1 (Completed):** Opening sequence (\`SplashScene\` $\\rightarrow$ \`StudioScene\` $\\rightarrow$ \`TitleScene\` $\\rightarrow$ 120s 9-scene \`PrologueScene\`), background patch trigger on first tap, and 100% template-faithful Fadyme & Mahmut key art and prologue illustrations.
- **Adım 2 (Completed):** 3-Part Tutorial (\`T-1..T-3\`), 6 narrative cutscenes, template-faithful event CGs (\`roadside_rest\`, \`shelter_evening\`), dark gothic anime Chibi battle sheets for heroes (\`fadyme\`, \`mahmut\`) and enemies (\`bellbound_dead\`, \`hollow_pilgrim\`), staggered AFK-Faithful 5v5 formation without UI overlap, and \`FinishScene\` restart flow.
- **Adım 3 (Next):** Online Gacha Main Hub (\`HomeScene\` / Sanctum), Live Banner Summon (\`SummonScene\` / "First Oath"), 20-Hero Roster & 4-Tab Growth (\`CharacterScene\`), Shop, Mail, and Daily/Weekly Tasks.
- **Adım 4:** Chapters 1–8 Campaign Map (\`ChaptersScene\`), Endless Corridor, Patrol idle rewards, and Boss Encounters.
- **Adım 5:** Audio & Cinematics — Google Flow (Veo 3.1) animated cutscenes, Lyria dark gothic BGM loops, and Chirp 3 HD voice packs.
- **Adım 6:** Admin Control Center (\`apps/admin\`), Cloudflare D1/R2 LiveOps publishing, and Android Release AAB verification.
`,

    '02_Canon_Characters_World_and_Art_Bible.md': `# 02 — Canonical Characters, World Bible & Visual Template Rules

## 1. Visual Continuity & Template Reference Rules
All character illustrations, event CGs, and Chibi sprite sheets MUST preserve 100% visual continuity with the locked canonical templates:
- **Fadyme (Age 22, Veil Support / Bell-Bearer):**
  - **Hair & Eyes:** Long wavy pale ash-blonde hair (cool light beige-blonde with ash-grey shading), luminous pale lavender-violet eyes.
  - **Attire:** Raised deep plum-black gothic hooded pilgrim mantle (\`#45293B\` lit, \`#22151E\` shadow) with ornate silver-lilac (\`#C9B6E4\`) filigree/spiderweb-crown trim along the hood edge, small silver bell earring/hairpin, high clean bone-ivory (\`#E9E2D4\`) neck scarf, black high-collar dress with silver-lilac vine embroidery.
  - **Signature Prop:** Small silver hand-bell on a delicate silver chain whose clapper is a slender silver thorn.
- **Mahmut (Age 28, Stone Frontline Tank / Former Sworn Palace Guard):**
  - **Hair & Face:** Tall, broad-shouldered weathered knight with thick messy dark-brown anime hair, light jaw stubble, tired-but-steady warm amber-brown eyes, bareheaded (no helmet).
  - **Armor & Cloak:** Battered dark charcoal steel half-plate repaired in mismatched village smith styles; a Crown Guard eight-pointed star on the center of the breastplate with a small empty hammered-out socket directly above it where a crown once sat; tattered crimson-oxblood scarf-cloak (\`#6B1E2C\` lit, \`#371C21\` shadow) draped over his shoulders.
  - **Weapons:** Repaired dark heater shield on his left forearm and a plain straight-guard arming sword in his right hand.
- **Tutorial Enemies (Whispering Ash Forest):**
  - **Bellbound Dead (\`bellbound_dead\`):** Slumped dark gothic anime Chibi Hollow wired to a tarnished bronze chest bell by iron chains running to both bony wrists; pale ash-bone skull-mask face under a tattered dark charcoal-plum hood.
  - **Hollow Pilgrim (\`hollow_pilgrim\`):** Stocky, hunched triangular Chibi silhouette in a coarse ash-beige hooded pilgrim robe with its face hidden in deep shadow under the hood, carrying a heavy brown leather road pack with a rolled bedroll and gripping a gnarled wooden walking staff.

---

## 2. Art Bible Summary (\`docs/media/ART_BIBLE.md\`)
${safeRead('docs/media/ART_BIBLE.md')}

---

## 3. Fadyme Canonical Reference (\`narrative/14_References/Fadyme_README.md\`)
${safeRead('narrative/14_References/Fadyme_README.md')}
`,

    '03_Prologue_and_Tutorial_Scripts_Complete.md': `# 03 — Complete Opening Prologue (9 Scenes) & 3-Part Tutorial Scripts (T-1 .. T-3)

## 1. Opening 120-Second Prologue (\`content/base/entry/prologue.json\`)
\`\`\`json
${prologueRaw}
\`\`\`

---

## 2. Tutorial Part 1 (\`T-1: The First Step\`)
### 2.1 Pre-Battle Cutscene (\`tutorial_t1_before.json\`)
\`\`\`json
${t1Before}
\`\`\`

### 2.2 Post-Battle Cutscene (\`tutorial_t1_after.json\`)
\`\`\`json
${t1After}
\`\`\`

---

## 3. Tutorial Part 2 (\`T-2: A Road Forgotten\`)
### 3.1 Pre-Battle Cutscene (\`tutorial_t2_before.json\`)
\`\`\`json
${t2Before}
\`\`\`

### 3.2 Post-Battle Cutscene (\`tutorial_t2_after.json\` — Shared CG Still: \`roadside_rest\`)
\`\`\`json
${t2After}
\`\`\`

---

## 4. Tutorial Part 3 (\`T-3: A Roof Before Dawn\`)
### 4.1 Pre-Battle Cutscene (\`tutorial_t3_before.json\`)
\`\`\`json
${t3Before}
\`\`\`

### 4.2 Post-Battle Cutscene (\`tutorial_t3_after.json\` — Shared CG Still: \`shelter_evening\`)
\`\`\`json
${t3After}
\`\`\`
`,

    '04_Combat_5v5_and_Gacha_Progression.md': `# 04 — 5v5 Tactical Turn-Based Combat Engine, Chibi Layout & Gacha Progression

## 1. Combat & Layout Architecture (\`docs/R10_LAYOUT_CONTRACT.md\`)
${safeRead('docs/R10_LAYOUT_CONTRACT.md')}

---

## 2. Chibi Sheet & Animation Specification (\`docs/media/specs/chibi_sheets.md\`)
${safeRead('docs/media/specs/chibi_sheets.md')}

---

## 3. Current Base Art Manifest (\`content/base/art/art_manifest.json\`)
\`\`\`json
${artManifest}
\`\`\`
`,

    '05_Cloudflare_LiveOps_and_Patch_Pipeline.md': `# 05 — Cloudflare Workers, D1, R2, Signed OTA Patching & Admin Control Center

## 1. Export & Ingestion Pipeline (\`docs/media/EXPORT_PIPELINE.md\`)
${safeRead('docs/media/EXPORT_PIPELINE.md')}

---

## 2. Infrastructure Roadmap & Checkpoint (\`docs/NEXT_STEPS.md\`)
${safeRead('docs/NEXT_STEPS.md')}
`,

    '06_AI_Ultra_Whisk_Flow_Genie_and_Phaser_MCP.md': `# 06 — Google AI Ultra Ecosystem Integration (NotebookLM Plus, Whisk, Flow, Project Genie) & Phaser 4 Live MCP

## 1. Overview of Active MCP Servers & Workflows
1. **\`uomd-pixi-live\` (\`tools/mcp_pixi_live.ts\`):**
   - Automatically syncs \`content/base\` into \`apps/game/public/content/base\`, boots a headless Chromium viewport at \`1920x1080\` against the Vite dev server, jumps directly to any Phaser 4 scene (\`Splash\`, \`Studio\`, \`Title\`, \`Prologue\`, \`Story\`, \`Battle\`, \`Finish\`, \`Home\`), captures live PNG screenshots, and returns scene state + console/page error diagnostics.
2. **\`uomd-ai-ultra\` (\`tools/mcp_ai_ultra_bridge.ts\`):**
   - \`ai_ultra_export_notebooklm_bundle\`: Builds and syncs this 6-part NotebookLM Plus Knowledge Hub in \`docs/notebooklm/\` and \`UOMD_NotebookLM_Hub\`.
   - \`ai_ultra_export_flow_storyboard\`: Generates 1080p Veo 3.1 storyboard JSON packages for Google Flow (\`prologue\`, \`first_oath_summon\`, \`boss_cutin\`) using our approved 16:9 stills as First/Last keyframes.
   - \`ai_ultra_prepare_genie_world_seed\`: Exports spatial world prompts and reference plates for DeepMind Project Genie (\`Genie 3\`) to extract multi-plane parallax layers.
   - \`ai_ultra_prepare_whisk_recipe\`: Prepares Subject + Scene + Style lock recipes for Google Whisk and Whisk Animate.

## 2. How to Use This Hub in NotebookLM Plus (\`notebooklm.google\`)
1. Open **NotebookLM Plus** (\`https://notebooklm.google\`) and create a notebook named **\`Unaware of My Demise — Master Hub\`**.
2. Click **Add Source $\\rightarrow$ Google Drive** and select the 6 Markdown files inside **\`Drive'ım / UOMD_NotebookLM_Hub\`** (or upload from \`docs/notebooklm/\`).
3. Whenever you run \`npx tsx tools/build_notebooklm_hub.ts\`, both \`docs/notebooklm/\` and \`Drive'ım / UOMD_NotebookLM_Hub\` are updated automatically.
`,
  };

  const writtenFiles: string[] = [];
  for (const [name, content] of Object.entries(filesMap)) {
    const target = join(DOCS_HUB, name);
    writeFileSync(target, content, 'utf8');
    writtenFiles.push(target);
  }

  let syncedDriveDir: string | null = null;
  try {
    mkdirSync(DRIVE_HUB, { recursive: true });
    for (const [name, content] of Object.entries(filesMap)) {
      writeFileSync(join(DRIVE_HUB, name), content, 'utf8');
    }
    const refDir = join(DRIVE_HUB, 'References');
    mkdirSync(refDir, { recursive: true });
    const brainDir = 'C:/Users/PC/.gemini/antigravity/brain/ae615d90-2a42-40b2-a6e5-fc5fda8f4a95';
    const refCandidates = [
      'ref_fadyme_template.jpg',
      'ref_mahmut_template.jpg',
      'ref_key_art_template.jpg',
      'ref_fadyme_chibi.jpg',
      'ref_mahmut_chibi.jpg',
      'ref_enemy_board.jpg',
    ];
    for (const refFile of refCandidates) {
      const src = join(brainDir, refFile);
      if (existsSync(src)) {
        copyFileSync(src, join(refDir, refFile));
      }
    }
    syncedDriveDir = DRIVE_HUB;
  } catch {
    // Ignore if parent directory is not writable
  }

  return {
    docsHubDir: DOCS_HUB,
    driveHubDir: syncedDriveDir,
    files: Object.keys(filesMap),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const res = buildNotebookLmHub();
  console.log(JSON.stringify(res, null, 2));
}
