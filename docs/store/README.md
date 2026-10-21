# English store and legal draft pack

Source revision `5c83e3d1`, 2026-10-11. Owner scope: **English only for now; Japanese voice acting**. These files are reviewable drafts, not published policies or a submitted Google Play questionnaire. App package: `io.github.mucaeksi.unawareofmydemise`. No production launch is claimed. Sources: root README, `docs/AAB_ACCESS_PLAN.md`, actual account export/delete/auth/billing/ads code and native Android manifest/UMP plugin.

| Deliverable | File | Review dependency |
|---|---|---|
| Play title, short/full description, release notes | `PLAY_LISTING_EN.md` | final AAB feature/content/media verification |
| App icon (`512×512`, 32-bit RGBA PNG, `≤ 1 MB`) | `assets/icon_512.png` (+ Android `res/mipmap-*/ic_launcher*.png`) | owner visual approval (`ART-3` / `B1`) |
| Feature graphic (`1024×500`, 24-bit RGB PNG, no alpha) | `assets/feature_graphic_1024x500.png` | owner visual approval (`ART-3` / `B2`) |
| Store screenshots (`6 × 1920×1080`, 24-bit RGB PNG, `16:9`) | `assets/screenshots/01_title_screen.png` .. `06_character_sheet.png` | captured from real builds (`ART-3` / `B3`) |
| Preview video (`~1:30` teaser) storyboard & production plan | `TEASER_STORYBOARD.md` | owner track/budget & YouTube channel (`ART-4` / `B4`) |
| Privacy policy | `PRIVACY_POLICY_EN.md` | legal operator/contact, purposes/legal basis, SDK disclosures, retention and public URL |
| Terms | `TERMS_EN.md` | operator, age/territory/law, product/subscription and refund terms |
| Ads/purchases disclosure | `ADS_PURCHASES_EN.md` | approved live product/rates/UMP configuration |
| Data Safety worksheet | `DATA_SAFETY.md` | final AAB SDK inventory/merged manifest and observed SDK data flows |
| Content-rating worksheet | `CONTENT_RATING.md` | final art/scripts/cinematics + IARC answers/assigned regional ratings |
| Authorized seller line | `app-ads.txt` | developer website domain hosting and Play listing website |

Required owner/lead facts before submission: UNKNOWN legal operator name/address/privacy contact/support contact; official developer website/domain; hosted privacy and externally accessible account-deletion request URLs; launch territories and audience/underage policy; retained-record legal basis and time limits including R2 backups/AdMob/Google; installed final SDK behavior; activated Play product IDs/base plans/offers/prices/renewal wording; final violence/horror/suggestive-content classification. No invented email, production URL, age rating, “no data shared,” retention deadline, refund promise or ad-free entitlement.

README older build descriptions are historical; current source contains native Android bridges and backend account/billing/ads functionality, but real-device acceptance is still required (`../QA_ANDROID.md`). Listing copy promises only the bounded initial tutorial once implemented; future story/event/arena/endless content must not be advertised as already released. Marketing assets must use approved Google-generated art, not provisional archived artwork.
