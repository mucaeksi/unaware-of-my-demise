# Third-party material shipped in the app

Record of everything not made by us that ends up in a build. Add a row when something is added; the credits screen is generated from this file.
Vetting notes and rejected candidates: `docs/media/FREE_ASSETS.md`. This is engineering due diligence, not legal advice.

| Item | Where | Source / retrieval | License / terms | Credit needed |
|---|---|---|---|---|
| Phaser 4.2.1 (engine) | `node_modules`, bundled | https://phaser.io | MIT, Copyright (c) 2013-2026 Phaser Studio Inc. (notice kept in the bundle) | notice only |
| Phaser pixel-art logo (`phaser-pixel-large-shaded.png`, 208x50) | `apps/game/src/assets/`, shown on the engine splash at 4x, NEAREST | https://cdn.phaser.io/images/logo/phaser-pixel-large-shaded.png, retrieved 2026-10-11, SHA-256 `707b0d15efe9f97a7d19e34ac78714d874f3f924a215b6a94892dbe5a16d67f0` | Logo page: pixel-art logos are "intended for use in your own games and demos (commercial and non-commercial alike)... free to re-colour" (https://phaser.io/download/logo). Trademark policy (https://www.phaser.io/download/trademark): may indicate a game was built with Phaser; no modification other than scaling/re-colouring (pixel set); no implied endorsement. The permission is a web page, not a license file: re-check the page before each store release, never use it in store icon/feature graphic. | "Made with Phaser" on the splash; credits line below |
| Cinzel, Cormorant Garamond (`@fontsource`) | bundled web fonts | npm `@fontsource/cinzel` 5.2.8, `@fontsource/cormorant-garamond` 5.2.11 | SIL OFL 1.1 | notice + license text required in credits |

## Credits text (credits screen, generated from the table above)

```
Engine: Phaser 4, Copyright (c) 2013-2026 Phaser Studio Inc., MIT License, https://phaser.io
Phaser and the Phaser logo are trademarks of Phaser Studio Inc. This game is not endorsed by or affiliated with Phaser Studio Inc.
Typefaces: Cinzel (Copyright 2020 The Cinzel Project Authors) and Cormorant Garamond (Copyright 2015 The Cormorant Project Authors),
licensed under the SIL Open Font License, Version 1.1, https://openfontlicense.org
```
