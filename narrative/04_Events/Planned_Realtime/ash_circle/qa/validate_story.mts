/** Current repo schema/interpreter checks. Run from repo root with tsx. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { StoryScene } from '../../../../../packages/content-schema/src/story.ts';
import { StoryRunner } from '../../../../../packages/story/src/runner.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(root + p, 'utf8'));
const scenes = read('authoring/story.json').scenes;
let paths = 0, savedLines = 0, choiceChecks = 0, checkpoints = 0;
const ids = new Set<string>();
for (const source of scenes) {
  const scene = StoryScene.parse(read(`story_json/${source.scene_id}.json`));
  const authored = [...source.lines, ...(source.choice?.options.flatMap((o: any) => o.lines) ?? [])];
  const exported = scene.commands.filter(c => c.op === 'say' || c.op === 'narrate');
  assert.equal(exported.length, authored.length);
  for (let i = 0; i < authored.length; i++) {
    const command = exported[i], line = authored[i];
    assert(!ids.has(line.line_id)); ids.add(line.line_id);
    assert.equal(command.line_id, line.line_id); assert.equal(command.text, line.text_en);
    if (command.op === 'say') assert.equal(command.speaker, line.speaker_id);
  }
  for (const option of source.choice?.options ?? [null]) {
    let runner = new StoryRunner(scene), ended = false;
    const actual: string[] = [];
    for (let guard = 0; guard < 500; guard++) {
      const before = runner.save(), event = runner.next();
      assert(event);
      if (event.type === 'line') {
        actual.push(event.lineId);
        const after = runner.save(), restored = new StoryRunner(scene, before);
        assert.deepEqual(restored.next(), event); assert.deepEqual(restored.save(), after);
        runner = new StoryRunner(scene, after); savedLines++;
      } else if (event.type === 'choice') {
        assert(option); assert.throws(() => runner.save());
        const restored = new StoryRunner(scene, before);
        assert.deepEqual(restored.next(), event);
        assert.throws(() => runner.choose('invalid_option'));
        runner.choose(option.id); restored.choose(option.id);
        assert.deepEqual(restored.save(), runner.save()); runner = restored; choiceChecks++;
      } else if (event.type === 'checkpoint') {
        assert.equal(event.checkpointId, `${scene.scene_id}_done`);
        const snap = runner.save(); runner = new StoryRunner(scene, snap);
        assert.deepEqual(runner.save(), snap); checkpoints++;
      } else if (event.type === 'end') { ended = true; break; }
    }
    assert(ended);
    assert.deepEqual(actual, [...source.lines, ...(option?.lines ?? [])].map((l: any) => l.line_id));
    assert.equal(runner.next(), null); paths++;
  }
}
const out = { status: 'PASS_CURRENT_STORY_SCHEMA_AND_VM', scenes: scenes.length, lines_all_variants: ids.size, paths,
  save_restore_line_checks: savedLines, choice_checks: choiceChecks, checkpoint_restore_checks: checkpoints,
  scope: 'Current StoryScene and StoryRunner; no media renderer/controller/server event implementation', runtime_enable_allowed: false };
writeFileSync(root + 'qa/STORY_VALIDATION.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out));
