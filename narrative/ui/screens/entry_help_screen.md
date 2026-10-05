# EntryHelpScreen

`ui.entry_help` · `entry_help_screen` · DESIGN_DRAFT / V03. [Registry](../SCREEN_REGISTRY.json), [view](../entry/screens/entry_help_screen.js).

Root: `Control/EntryHelpScreen`. Children: `SafeArea/TopBar/BackButton`, `Title`, `Body/ScrollContainer/HelpCards`, `PrivacyPolicyButton`.

Shipped English help covers Google sign-in, required file updates, interrupted downloads and the difference between signing out and deleting progress. Contact Support uses owner-approved `unawareofmydemise@gmail.com` (D-01 / DEC-0036 / current StoryDirector). A mail link opens the player's mail app; no message is generated or sent by this work. No story spoilers. No downloaded Narrative content or player snapshot dependency.

Back returns to the entry foundation and leaves background downloads running. Help remains available when offline. Privacy Policy uses the real configured URL in the shipped app. An absent/failed link reports unavailability; this prototype does not fabricate a legal policy, contact address or support service.

Input: optional verified policy URL and device connection/link outcome. Signals: `back_requested`, `privacy_requested`. The policy URL must be configured for publication; the availability message is a review fallback.
