# SignInScreen

`ui.sign_in` · `sign_in_screen` · DESIGN_DRAFT / V03. [Registry](../SCREEN_REGISTRY.json), [view](../entry/screens/sign_in_screen.js).

Root: `Control/SignInScreen`. Suggested children: `SafeArea/TopBar`, `Artwork`, `Body/Tagline`, `Body/GoogleSignInButton`, `Body/SignInStatus`, `Footer`. Approved logo-bearing key art is contained, never cropped or edited.

English CTA: `Continue with Google`; returning account: `Continue`. No guest/email/Apple option or fake account data. Settings and Help are public. Sign Out is absent without a session.

Input: returning-account hint, pending state, release/auth outcome, device preferences. Output: `sign_in_requested`, `settings_requested`, `help_requested`. Offline, app-version gate, maintenance, cancellation, missing account and unavailable credential provider have separate outcomes. Sign-in cannot be double-submitted; cancellation invalidates late results.

Preflight may block an obsolete app or maintenance before Google. On successful Google session the entry foundation becomes PatchScreen. No snapshot, wallet or story scene is shown before verified content. Session tokens stay in Online memory, outside page props and local preferences.

Main `10b42fb` now includes `TitleScreen` (tap-to-start/loading behind it). SignInScreen is the separate credential-entry surface, not a conflicting new TitleScreen class. Its approved artwork can share the title visual shell. Preserve the title preflight/early-tap ownership when integrating this visual design.
