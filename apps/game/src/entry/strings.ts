/** Every line of text the game screens show, mapped by stable English keys (localisation maps these keys). */
export const S = {
  splash: { made: 'MADE WITH', engine: 'PHASER' },
  studio: { name: 'SovTaym Studios', presents: 'PRESENTS' },
  menu: {
    tagline: 'PART I  ·  UNAWARE, I FADE',
    tapToContinue: 'TAP TO CONTINUE',
    tapSubFirstRun: 'Touch anywhere to begin the prologue',
    tapSubReturn: 'Touch anywhere to enter the road',
    serverOnline: '● SANCTUM-01  ·  ONLINE',
    signIn: 'SIGN IN WITH GOOGLE',
    signInSub: 'Your journey is saved to your account',
    cont: 'CONTINUE',
    contSub: 'Resume the road',
    enterRoad: 'Enter the Road',
    chapters: 'CHAPTERS',
    company: 'COMPANY',
    preview: 'PREVIEW BUILD',
    previewSub: 'Continue without an account',
    settings: 'SETTINGS',
    webNote: 'Google sign-in runs inside the Android app.',
    offline: 'The first start needs a connection to download the road. Check your network and try again.',
    signInFailed: 'Sign-in did not complete. Nothing was changed.'
  },
  finish: {
    waitingTitle: 'THE ROAD IS BEING PREPARED',
    waitingBody: 'The rest of the game is still arriving. You can keep the app open; this page continues by itself.',
    readyTitle: 'EVERYTHING IS INSTALLED',
    readyBody: 'The game will restart once and open at the main menu.',
    restart: 'RESTART & ENTER GAME',
    restarting: 'RESTARTING…',
    retry: 'TRY AGAIN',
    failedBody: 'The download could not finish. Check your connection and try again; nothing already downloaded is lost.'
  },
  patch: {
    checking: 'Looking for the road',
    downloading: 'Downloading the road',
    verifying: 'Verifying what was downloaded',
    activating: 'Almost ready',
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

