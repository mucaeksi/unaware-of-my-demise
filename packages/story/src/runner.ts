import type { StoryCommand, StoryScene } from '@uomd/content-schema';

export type StoryEvent =
  | { type: 'background'; locationId: string }
  | { type: 'music'; cueId: string }
  | { type: 'fade'; direction: 'in' | 'out'; seconds: number }
  | { type: 'show'; character: string; side: 'left' | 'right' }
  | { type: 'hide'; character: string }
  | { type: 'flash'; seconds: number }
  | { type: 'shake'; seconds: number; intensity: number }
  | { type: 'wait'; seconds: number }
  | { type: 'line'; lineId: string; speaker: string; speakerDisplay: string; text: string; emotion?: string; holdSeconds?: number }
  | { type: 'choice'; prompt?: string; options: { id: string; text: string }[] }
  | { type: 'checkpoint'; checkpointId: string }
  | { type: 'end' };

/** Events that need the player (or a timer) before the story may continue. */
export const isBlocking = (e: StoryEvent): boolean => e.type === 'line' || e.type === 'choice' || e.type === 'wait' || e.type === 'end';

export interface StorySave {
  sceneId: string;
  index: number;
  choices: string[];
}

/**
 * Interpreter for the declarative story command list. It owns no rendering and no clock: the
 * presentation layer pulls events with next() and decides how long each one takes. The only state
 * is a program counter, the choices made and the line history (backlog), so a save is tiny.
 */
export class StoryRunner {
  readonly history: Extract<StoryEvent, { type: 'line' }>[] = [];
  private pc = 0;
  private readonly labels = new Map<string, number>();
  private readonly choices: string[] = [];
  private pendingChoice: Extract<StoryCommand, { op: 'choice' }> | null = null;
  private ended = false;

  constructor(private readonly scene: StoryScene, save?: StorySave) {
    scene.commands.forEach((c, i) => {
      if (c.op === 'label') this.labels.set(c.name, i);
    });
    if (save) {
      if (save.sceneId !== scene.scene_id) throw new Error('save belongs to another scene');
      this.pc = Math.min(Math.max(0, save.index), scene.commands.length);
      this.choices.push(...save.choices);
    }
  }

  get finished(): boolean {
    return this.ended;
  }

  /** Next event, or null once the scene is over. Pending choices must be answered via choose(). */
  next(): StoryEvent | null {
    if (this.ended) return null;
    if (this.pendingChoice) throw new Error('a choice is pending; call choose() first');
    for (;;) {
      const cmd = this.scene.commands[this.pc];
      if (!cmd) {
        this.ended = true;
        return { type: 'end' };
      }
      this.pc++;
      switch (cmd.op) {
        case 'label':
          continue;
        case 'goto':
          this.pc = this.mustLabel(cmd.label);
          continue;
        case 'background':
          return { type: 'background', locationId: cmd.location_id };
        case 'music':
          return { type: 'music', cueId: cmd.cue_id };
        case 'fade':
          return { type: 'fade', direction: cmd.direction, seconds: cmd.seconds };
        case 'show':
          return { type: 'show', character: cmd.character, side: cmd.side };
        case 'hide':
          return { type: 'hide', character: cmd.character };
        case 'flash':
          return { type: 'flash', seconds: cmd.seconds };
        case 'shake':
          return { type: 'shake', seconds: cmd.seconds, intensity: cmd.intensity };
        case 'wait':
          return { type: 'wait', seconds: cmd.seconds };
        case 'checkpoint':
          return { type: 'checkpoint', checkpointId: cmd.checkpoint_id };
        case 'say': {
          const e: StoryEvent = { type: 'line', lineId: cmd.line_id, speaker: cmd.speaker, speakerDisplay: cmd.speaker_display, text: cmd.text };
          if (cmd.emotion) e.emotion = cmd.emotion;
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          return e;
        }
        case 'narrate': {
          const e: StoryEvent = { type: 'line', lineId: cmd.line_id, speaker: 'narration', speakerDisplay: '', text: cmd.text };
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          return e;
        }
        case 'choice': {
          this.pendingChoice = cmd;
          const e: StoryEvent = { type: 'choice', options: cmd.options.map((o) => ({ id: o.id, text: o.text })) };
          if (cmd.prompt) e.prompt = cmd.prompt;
          return e;
        }
        case 'end':
          this.ended = true;
          return { type: 'end' };
      }
    }
  }

  choose(optionId: string): void {
    const c = this.pendingChoice;
    if (!c) throw new Error('no choice is pending');
    const opt = c.options.find((o) => o.id === optionId);
    if (!opt) throw new Error(`unknown option ${optionId}`);
    this.choices.push(optionId);
    this.pendingChoice = null;
    this.pc = this.mustLabel(opt.goto);
  }

  save(): StorySave {
    if (this.pendingChoice) throw new Error('cannot save while a choice is pending');
    return { sceneId: this.scene.scene_id, index: this.pc, choices: [...this.choices] };
  }

  private mustLabel(name: string): number {
    const i = this.labels.get(name);
    if (i === undefined) throw new Error(`unknown label ${name}`);
    return i;
  }
}
