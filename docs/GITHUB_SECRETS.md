# GitHub Secrets

Repository: **Settings → Secrets and variables → Actions → New repository secret**

## Android / Google Play deployment

Create these repository secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64
```

Create this repository variable (not secret):

```text
GOOGLE_PLAY_PACKAGE_NAME
```

## Google AI / Gemini

For Google AI / Gemini access, create:

```text
GEMINI_API_KEY
```

Use a Gemini API key created through Google AI Studio / Google Cloud credentials. Keep it server-side. Do **not** put it in Godot project files, GDScript, exported AAB files, or client-side configuration.

Google currently recommends environment variables such as `GEMINI_API_KEY` for the Gemini SDK. New AI Studio keys are authorization keys; unrestricted legacy standard keys are no longer the intended production configuration. See Google's current Gemini API key documentation.

For a deployment to a VPS, the same `GEMINI_API_KEY` must also exist in the backend's server environment (for example `/etc/gacha-game/backend.env`, a systemd EnvironmentFile, Docker secret, or another secret manager). GitHub Secrets alone do not automatically become environment variables on a separately managed VPS.

## Local development

Copy:

```text
.env.example → .env
```

and set:

```text
GEMINI_API_KEY=your_key_here
```

Never commit `.env`.
