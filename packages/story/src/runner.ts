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

export interface RestoredSceneState {
  locationId: string;
  musicCueId: string | null;
  actors: Map<string, { side: 'left' | 'right'; emotion: string }>;
  prevSpeaker: string | null;
}

/**
 * Interpreter for the declarative story command list. It owns no rendering and no clock: the
 * presentation layer pulls events with next() and decides how long each one takes. The only state
 * is a program counter, the choices made and the line history (backlog), so a save is tiny.
 */
export class StoryRunner {
  readonly history: Extract<StoryEvent, { type: 'line' }>[] = [];
  readonly restored: RestoredSceneState;
  private pc = 0;
  private currentBlockingPc: number | null = null;
  private readonly flags: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
  private readonly labels = new Map<string, number>();
  private readonly choices: string[] = [];
  private pendingChoice: Extract<StoryCommand, { op: 'choice' }> | null = null;
  private ended = false;
  private controlSteps = 0;

  constructor(private readonly scene: StoryScene, save?: StorySave) {
    this.restored = { locationId: scene.location_id, musicCueId: null, actors: new Map(), prevSpeaker: null };
    scene.commands.forEach((c, i) => {
      if (c.op === 'label') this.labels.set(c.name, i);
    });
    if (save) {
      if (save.sceneId !== scene.scene_id) throw new Error('save belongs to another scene');
      this.pc = Math.min(Math.max(0, save.index), scene.commands.length);
      this.choices.push(...save.choices);
      if (save.flags) {
        if (Object.keys(save.flags).length > 128 || Object.entries(save.flags).some(([key, value]) => !/^[a-z][a-z0-9_]{1,79}$/.test(key) || typeof value !== 'boolean'))
          throw new Error('invalid saved flags');
        Object.assign(this.flags, save.flags);
      }
      this.reconstructUntil(this.pc, save.choices);
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
      const cmdPc = this.pc;
      const cmd = this.scene.commands[cmdPc];
      if (!cmd) {
        this.ended = true;
        this.currentBlockingPc = null;
        return { type: 'end' };
      }
      this.pc++;
      switch (cmd.op) {
        case 'set_flag': this.flags[cmd.flag] = cmd.value; continue;
        case 'branch': if ((this.flags[cmd.flag] ?? false) === cmd.equals) this.pc = this.mustLabel(cmd.goto); continue;
        case 'voice': case 'sound': case 'video': case 'layer': case 'remove_layer': case 'animate': case 'camera': case 'mask': case 'panel':
          if (cmd.op === 'video' || cmd.op === 'panel' || cmd.op === 'animate' && cmd.wait && cmd.seconds > 0) {
            this.controlSteps = 0;
            this.currentBlockingPc = cmdPc;
          } else {
            this.currentBlockingPc = null;
          }
          return { type: 'presentation', command: cmd };
        case 'label':
          continue;
        case 'goto':
          this.pc = this.mustLabel(cmd.label);
          continue;
        case 'background':
          this.currentBlockingPc = null;
          this.restored.locationId = cmd.location_id;
          return { type: 'background', locationId: cmd.location_id };
        case 'music':
          this.currentBlockingPc = null;
          this.restored.musicCueId = cmd.cue_id;
          return { type: 'music', cueId: cmd.cue_id };
        case 'fade':
          this.currentBlockingPc = null;
          return { type: 'fade', direction: cmd.direction, seconds: cmd.seconds };
        case 'show':
          this.currentBlockingPc = null;
          this.restored.actors.set(cmd.character, { side: cmd.side, emotion: 'composed' });
          return { type: 'show', character: cmd.character, side: cmd.side };
        case 'hide':
          this.currentBlockingPc = null;
          this.restored.actors.delete(cmd.character);
          return { type: 'hide', character: cmd.character };
        case 'flash':
          this.currentBlockingPc = null;
          return { type: 'flash', seconds: cmd.seconds };
        case 'shake':
          this.currentBlockingPc = null;
          return { type: 'shake', seconds: cmd.seconds, intensity: cmd.intensity };
        case 'wait':
          if (cmd.seconds > 0) this.controlSteps = 0;
          this.currentBlockingPc = cmdPc;
          return { type: 'wait', seconds: cmd.seconds };
        case 'checkpoint':
          this.currentBlockingPc = null;
          return { type: 'checkpoint', checkpointId: cmd.checkpoint_id };
        case 'say': {
          this.controlSteps = 0;
          this.currentBlockingPc = cmdPc;
          this.restored.prevSpeaker = cmd.speaker;
          const actor = this.restored.actors.get(cmd.speaker);
          if (actor && cmd.emotion) actor.emotion = cmd.emotion;
          const e: StoryEvent = { type: 'line', lineId: cmd.line_id, speaker: cmd.speaker, speakerDisplay: cmd.speaker_display, text: cmd.text };
          if (cmd.emotion) e.emotion = cmd.emotion;
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          return e;
        }
        case 'narrate': {
          this.controlSteps = 0;
          this.currentBlockingPc = cmdPc;
          this.restored.prevSpeaker = 'narration';
          const e: StoryEvent = { type: 'line', lineId: cmd.line_id, speaker: 'narration', speakerDisplay: '', text: cmd.text };
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          return e;
        }
        case 'choice': {
          this.controlSteps = 0;
          this.currentBlockingPc = cmdPc;
          this.pendingChoice = cmd;
          const e: StoryEvent = { type: 'choice', options: cmd.options.map((o) => ({ id: o.id, text: o.text })) };
          if (cmd.prompt) e.prompt = cmd.prompt;
          return e;
        }
        case 'end':
          this.ended = true;
          this.currentBlockingPc = null;
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
    this.currentBlockingPc = null;
    this.pc = this.mustLabel(opt.goto);
  }

  save(): StorySave {
    if (this.pendingChoice) throw new Error('cannot save while a choice is pending');
    return { sceneId: this.scene.scene_id, index: this.pc, choices: [...this.choices], ...(Object.keys(this.flags).length ? { flags: { ...this.flags } } : {}) };
  }

  /** Saves a resume snapshot at the currently displayed blocking line/choice/wait so reloading replays that active prompt. */
  saveAtCurrentEvent(): StorySave {
    const idx = this.currentBlockingPc ?? this.pc;
    return { sceneId: this.scene.scene_id, index: idx, choices: [...this.choices], ...(Object.keys(this.flags).length ? { flags: { ...this.flags } } : {}) };
  }

  private reconstructUntil(targetPc: number, savedChoices: string[]): void {
    const walkFlags: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
    let cursor = 0;
    let choiceIdx = 0;
    let steps = 0;
    const maxSteps = this.scene.commands.length * 4;
    while (cursor < this.scene.commands.length && cursor !== targetPc && steps++ < maxSteps) {
      const cmd = this.scene.commands[cursor]!;
      cursor++;
      switch (cmd.op) {
        case 'set_flag':
          walkFlags[cmd.flag] = cmd.value;
          break;
        case 'branch':
          if ((walkFlags[cmd.flag] ?? this.flags[cmd.flag] ?? false) === cmd.equals) {
            const dst = this.labels.get(cmd.goto);
            if (dst !== undefined) cursor = dst;
          }
          break;
        case 'goto': {
          const dst = this.labels.get(cmd.label);
          if (dst !== undefined) cursor = dst;
          break;
        }
        case 'choice': {
          const chosen = savedChoices[choiceIdx++];
          const opt = chosen ? cmd.options.find((o) => o.id === chosen) : undefined;
          const dst = opt ? this.labels.get(opt.goto) : undefined;
          if (dst !== undefined) cursor = dst;
          break;
        }
        case 'background':
          this.restored.locationId = cmd.location_id;
          break;
        case 'music':
          this.restored.musicCueId = cmd.cue_id;
          break;
        case 'show':
          this.restored.actors.set(cmd.character, { side: cmd.side, emotion: 'composed' });
          break;
        case 'hide':
          this.restored.actors.delete(cmd.character);
          break;
        case 'say': {
          this.restored.prevSpeaker = cmd.speaker;
          const actor = this.restored.actors.get(cmd.speaker);
          if (actor && cmd.emotion) actor.emotion = cmd.emotion;
          const e: Extract<StoryEvent, { type: 'line' }> = { type: 'line', lineId: cmd.line_id, speaker: cmd.speaker, speakerDisplay: cmd.speaker_display, text: cmd.text };
          if (cmd.emotion) e.emotion = cmd.emotion;
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          break;
        }
        case 'narrate': {
          this.restored.prevSpeaker = 'narration';
          const e: Extract<StoryEvent, { type: 'line' }> = { type: 'line', lineId: cmd.line_id, speaker: 'narration', speakerDisplay: '', text: cmd.text };
          if (cmd.hold_seconds !== undefined) e.holdSeconds = cmd.hold_seconds;
          this.history.push(e);
          break;
        }
      }
    }
  }

  private mustLabel(name: string): number {
    const i = this.labels.get(name);
    if (i === undefined) throw new Error(`unknown label ${name}`);
    return i;
  }
}
