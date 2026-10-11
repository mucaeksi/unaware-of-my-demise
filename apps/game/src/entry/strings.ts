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
  }
} as const;
