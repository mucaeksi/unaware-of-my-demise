# Third-party material shipped in the app

Record of everything not made by us that ends up in a build. Add a row when something is added; the credits screen is generated from this file.
Vetting notes and rejected candidates: `docs/media/FREE_ASSETS.md`. This is engineering due diligence, not legal advice.

| Item | Where | Source / retrieval | License / terms | Credit needed |
|---|---|---|---|---|
| Unity 6.3 LTS (`6000.3.x`, Universal Render Pipeline 2D) | Target Android AAB runtime (`apps/unity/`, Decision D-31) | https://unity.com | Unity Terms of Service / Runtime Fee & Splash policy | Standard Unity credit / license notice |
| Cinzel, Cormorant Garamond (`@fontsource` / SDF Font Assets) | Bundled game & admin fonts | npm `@fontsource/cinzel` 5.2.8, `@fontsource/cormorant-garamond` 5.2.11 | SIL OFL 1.1 | notice + license text required in credits |
| *(Handed-over Legacy Reference Only)* `unity-urp-2d` 8.x & `unity-filters` 6.1.5 | `apps/game` (retained only as transition test oracle until Phase U-6 archival into `archive/legacy-web-era`; Phaser 4 was retired in D-23) | https://unity.com | MIT License | Only if legacy web preview is served |

## Credits text (credits screen, generated from the table above)

```
Engine: Built with Unity 6 LTS (Universal Render Pipeline 2D). Unity is a trademark or registered trademark of Unity Technologies.
Typefaces: Cinzel (Copyright 2020 The Cinzel Project Authors) and Cormorant Garamond (Copyright 2015 The Cormorant Project Authors),
licensed under the SIL Open Font License, Version 1.1, https://openfontlicense.org
```
