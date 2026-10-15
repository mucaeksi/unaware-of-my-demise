/** Every line of text the game screens show, mapped by stable English keys (localisation maps these keys). */
export const S = {
  splash: { made: 'MADE WITH', engine: 'PHASER' },
  studio: { name: 'SovTaym Studios', presents: 'PRESENTS' },
  menu: {
    tagline: 'PART I  ·  UNAWARE, I FADE',
    tapToContinue: 'TAP TO START',
    tapSubFirstRun: 'Touch anywhere to sign in with Google Play & begin',
    tapSubReturn: 'Touch anywhere to sign in & continue your journey',
    serverOnline: '● SANCTUM-01  ·  ONLINE',
    signIn: 'SIGN IN WITH GOOGLE PLAY',
    signInSub: 'Your journey is saved to your Google Play account',
    cont: 'TAP TO START',
    contSub: 'Resume the road',
    enterRoad: 'Enter the Road',
    chapters: 'CHAPTERS',
    company: 'COMPANY',
    preview: 'GOOGLE PLAY GAMES',
    previewSub: 'Connect & check for updates',
    settings: 'SETTINGS',
    webNote: 'Google sign-in runs inside the Android app.',
    offline: 'The first start needs a connection to download the road. Check your network and try again.',
    signInFailed: 'Sign-in did not complete. Nothing was changed.'
  },
  finish: {
    waitingTitle: 'THE ROAD IS BEING PREPARED',
    waitingBody: 'Downloading and verifying the latest patch while the music plays. The game will restart automatically as soon as the patch finishes.',
    readyTitle: 'EVERYTHING IS INSTALLED',
    readyBody: 'Patch complete. Restarting client…',
    restart: 'RESTART & ENTER GAME',
    restarting: 'RESTARTING…',
    retry: 'TRY AGAIN',
    failedBody: 'The download could not finish. Check your connection and try again; nothing already downloaded is lost.'
  },
  patch: {
    checking: 'Checking for patches…',
    downloading: 'Downloading game patch…',
    verifying: 'Verifying signed manifest…',
    activating: 'Applying update…',
    failed: 'The download was interrupted. Tap to try again.',
    updateRequired: 'This version of the game is too old for the road ahead. Please update the app.',
    retrying: 'Trying again…'
  },
  settings: {
    heading: 'SETTINGS',
    music: 'Music',
    effects: 'Effects',
    voice: 'Voice',
    language: 'Language',
    textSpeed: 'Text speed',
    reducedMotion: 'Reduced motion',
    textSize: 'Text size',
    contrast: 'Contrast',
    flash: 'Flash effects',
    quality: 'Graphics tier',
    battleLayout: 'Battle layout',
    privacy: 'PRIVACY OPTIONS',
    resetProgress: 'RESET PROGRESS',
    close: 'CLOSE'
  },
  hub: {
    back: 'BACK',
    signInPrompt: 'Sign in to use this screen.',
    account: 'ACCOUNT'
  },
  battle: {
    turnOrder: 'TURN ORDER',
    auto: 'AUTO',
    autoOn: 'AUTO ✓',
    menu: 'MENU',
    paused: 'PAUSED',
    resume: 'RESUME',
    retreat: 'RETREAT',
    retreatSub: 'Leave the battle',
    victory: 'VICTORY',
    defeat: 'DEFEAT',
    continue: 'CONTINUE',
    retry: 'RETRY',
    retrySave: 'RETRY SAVE',
    saving: 'SAVING…',
    leave: 'LEAVE',
    backToStory: 'BACK TO STORY',
    chooseTarget: 'CHOOSE A TARGET',
    tapSkillOrTarget: 'TAP THE SKILL AGAIN OR THE TARGET',
    tapAgainToCast: 'TAP AGAIN TO CAST'
  },
  companion: {
    heading: 'COMPANION',
    skills: 'SKILLS',
    levelUp: 'LEVEL UP',
    ascend: 'ASCEND',
    rankUp: 'RANK UP',
    max: 'MAX',
    change: 'CHANGE',
    emptySlot: '— empty —'
  }
} as const;

/** Iconic lines from the narrative shown beneath the patch box so the player has atmospheric reading while updates download. */
export const RANDOM_GAME_QUOTES: ReadonlyArray<{ quote: string; speaker: string }> = [
  { quote: '“Beside it. Not behind you. I know the difference.”', speaker: 'Fadyme  ·  The Whispering Ash' },
  { quote: '“That stone is loose. Give me your hand.”  —  “For the stone, or for the whole road?”', speaker: 'Mahmut & Fadyme' },
  { quote: '“A flaw in the architecture of the loaf. Quite beyond my control.”', speaker: 'Fadyme  ·  A Roof Before Dawn' },
  { quote: '“Wait for my shield. Do not let them separate us.”', speaker: 'Mahmut  ·  Oathless Vanguard' },
  { quote: '“Stay a little while. Before you stand watch.”  —  “I am here.”', speaker: 'Fadyme & Mahmut' },
  { quote: '“The bell kept the village hours long before the war taught it to count the missing.”', speaker: 'Chronicle of Veyrhold' },
  { quote: '“I would rather we reached somewhere ordinary. With an especially ordinary supper.”', speaker: 'Fadyme  ·  A Road Forgotten' },
  { quote: '“Even your armour is asking for a rest. Hold still.”', speaker: 'Fadyme  ·  Roadside Rest' },
  { quote: '“We leave when there is light. No hurry.”  —  “And no walking two steps ahead.”', speaker: 'Mahmut & Fadyme' }
];

export const EN_STRINGS: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(S).reduce<Record<string, string>>((acc, [group, entries]) => {
    for (const [k, v] of Object.entries(entries)) {
      acc[`${group}.${k}`] = v;
    }
    return acc;
  }, {})
);

let activeLocaleStrings: Readonly<Record<string, string>> = {};

export function setActiveLocaleStrings(strings?: Readonly<Record<string, string>>): void {
  activeLocaleStrings = strings ?? {};
}

export function str(key: string, vars?: Record<string, string | number>): string {
  let template = activeLocaleStrings[key] ?? EN_STRINGS[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      template = template.replaceAll(`{${k}}`, String(v));
    }
  }
  return template;
}

