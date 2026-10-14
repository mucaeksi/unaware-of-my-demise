import type { PresentationCommand, StoryCommand, StoryScene } from '@uomd/content-schema';

export type StoryEvent =
  | { type: 'presentation'; command: PresentationCommand }
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
export const isBlocking = (e: StoryEvent): boolean => e.type === 'line' || e.type === 'choice' || e.type === 'wait' || e.type === 'end' || e.type === 'presentation' && (e.command.op === 'video' || e.command.op === 'panel' || e.command.op === 'animate' && e.command.wait);

export interface StorySave {
  sceneId: string;
  index: number;
  choices: string[];
  flags?: Record<string, boolean>;
}

/**
 * Interpreter for the declarative story command list. It owns no rendering and no clock: the
 * presentation layer pulls events with next() and decides how long each one takes. The only state
 * is a program counter, the choices made and the line history (backlog), so a save is tiny.
 */
export class StoryRunner {
  readonly history: Extract<StoryEvent, { type: 'line' }>[] = [];
  private pc = 0;
  private readonly flags: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
  private readonly labels = new Map<string, number>();
  private readonly choices: string[] = [];
  private pendingChoice: Extract<StoryCommand, { op: 'choice' }> | null = null;
  private ended = false;
  private controlSteps = 0;

  constructor(private readonly scene: StoryScene, save?: StorySave) {
    scene.commands.forEach((c, i) => {
      if (c.op === 'label') this.labels.set(c.name, i);
    });
    if (save) {
      if (save.sceneId !== scene.scene_id) throw new Error('save belongs to another scene');
      this.pc = Math.min(Math.max(0, save.index), scene.commands.length);
      this.choices.push(...save.choices);
      if (save.flags) { if (Object.keys(save.flags).length > 128 || Object.entries(save.flags).some(([key, value]) => !/^[a-z][a-z0-9_]{1,79}$/.test(key) || typeof value !== 'boolean')) throw new Error('invalid saved flags'); Object.assign(this.flags, save.flags); }
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
      if (++this.controlSteps > this.scene.commands.length * 4) throw new Error('story control flow exceeded its finite step budget');
      const cmd = this.scene.commands[this.pc];
      if (!cmd) {
        this.ended = true;
        return { type: 'end' };
      }
      this.pc++;
      switch (cmd.op) {
        case 'set_flag': this.flags[cmd.flag] = cmd.value; continue;
        case 'branch': if ((this.flags[cmd.flag] ?? false) === cmd.equals) this.pc = this.mustLabel(cmd.goto); continue;
        case 'voice': case 'sound': case 'video': case 'layer': case 'remove_layer': case 'animate': case 'camera': case 'mask': case 'panel':
          if (cmd.op === 'video' || cmd.op === 'panel' || cmd.op === 'animate' && cmd.wait && cmd.seconds > 0) this.controlSteps = 0;
          return { type: 'presentation', command: cmd };
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
          if (cmd.seconds > 0) this.controlSteps = 0;
          return { type: 'wait', seconds: cmd.seconds };
        case 'checkpoint':
          return { type: 'checkpoint', checkpointId: cmd.checkpoint_id };
        case 'say': {
          this.controlSteps = 0;
          const e: StoryEvent = { type: 'line', lineId: cmd.line_id, speaker: cmd.speaker, speakerDisplay: cmd.speaker_display, text: cmd.text };
          if (cmd.emotion) e.emotion = cmd.emotion;
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          return e;
        }
        case 'narrate': {
          this.controlSteps = 0;
          const e: StoryEvent = { type: 'line', lineId: cmd.line_id, speaker: 'narration', speakerDisplay: '', text: cmd.text };
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          return e;
        }
        case 'choice': {
          this.controlSteps = 0;
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
    return { sceneId: this.scene.scene_id, index: this.pc, choices: [...this.choices], ...(Object.keys(this.flags).length ? { flags: { ...this.flags } } : {}) };
  }

  private mustLabel(name: string): number {
    const i = this.labels.get(name);
    if (i === undefined) throw new Error(`unknown label ${name}`);
    return i;
  }
}
