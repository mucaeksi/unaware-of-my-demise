/** Every line of text the first-install screens show, in one place (localisation later maps these keys). */
export const S = {
  splash: { made: 'MADE WITH', engine: 'PHASER' },
  studio: { name: 'SovTaym Studios', presents: 'PRESENTS' },
  menu: {
    tagline: 'PART I  ·  UNAWARE, I FADE',
    signIn: 'SIGN IN WITH GOOGLE',
    signInSub: 'Your journey is saved to your account',
    cont: 'CONTINUE',
    contSub: 'Resume the road',
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
  }
} as const;
