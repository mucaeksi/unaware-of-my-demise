package io.github.mucaeksi.unawareofmydemise;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/**
 * Sign in with Google through Android Credential Manager and persist the opaque server session in AndroidKeyStore-encrypted storage.
 * The only identity token handed to JS is the Google ID token, which the game server verifies (signature, issuer, audience, expiry).
 */
@CapacitorPlugin(name = "UomdGoogleSignIn")
public class UomdGoogleSignInPlugin extends Plugin {
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "uomd_session_key_v1";
    private static final String PREFS_FILE = "uomd.secure_session.v1";
    private static final String PREF_IV = "iv";
    private static final String PREF_CIPHERTEXT = "ct";
    private static final int GCM_TAG_BITS = 128;

    private ExecutorService executor;

    private synchronized ExecutorService executor() {
        if (executor == null || executor.isShutdown() || executor.isTerminated()) {
            executor = Executors.newSingleThreadExecutor();
        }
        return executor;
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (this) {
            if (executor != null) {
                executor.shutdownNow();
                executor = null;
            }
        }
        super.handleOnDestroy();
    }

    private SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE_PROVIDER);
        ks.load(null);
        KeyStore.Entry existing = ks.getEntry(KEY_ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        kg.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return kg.generateKey();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);
    }

    private void clearEncryptedSession() {
        prefs().edit().remove(PREF_IV).remove(PREF_CIPHERTEXT).apply();
    }

    @PluginMethod
    public void writeSession(PluginCall call) {
        String token = call.getString("token");
        String expiresAt = call.getString("expiresAt");
        String playerId = call.getString("playerId");
        if (token == null || token.isEmpty() || expiresAt == null || expiresAt.isEmpty()) {
            call.reject("token and expiresAt required", "bad_request");
            return;
        }
        try {
            JSONObject payload = new JSONObject();
            payload.put("token", token);
            payload.put("expiresAt", expiresAt);
            if (playerId != null && !playerId.isEmpty()) payload.put("playerId", playerId);

            SecretKey key = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(payload.toString().getBytes(StandardCharsets.UTF_8));
            prefs()
                .edit()
                .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(PREF_CIPHERTEXT, Base64.encodeToString(ct, Base64.NO_WRAP))
                .apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not persist encrypted session", "keystore_error");
        }
    }

    @PluginMethod
    public void readSession(PluginCall call) {
        SharedPreferences sp = prefs();
        String ivB64 = sp.getString(PREF_IV, null);
        String ctB64 = sp.getString(PREF_CIPHERTEXT, null);
        JSObject empty = new JSObject().put("token", JSObject.NULL).put("expiresAt", JSObject.NULL).put("playerId", JSObject.NULL);
        if (ivB64 == null || ctB64 == null) {
            call.resolve(empty);
            return;
        }
        try {
            SecretKey key = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
            byte[] ct = Base64.decode(ctB64, Base64.NO_WRAP);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            String json = new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
            JSONObject parsed = new JSONObject(json);
            JSObject out = new JSObject();
            out.put("token", parsed.optString("token", null));
            out.put("expiresAt", parsed.optString("expiresAt", null));
            String pid = parsed.optString("playerId", "");
            out.put("playerId", pid.isEmpty() ? JSObject.NULL : pid);
            call.resolve(out);
        } catch (Exception e) {
            clearEncryptedSession();
            call.resolve(empty);
        }
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        clearEncryptedSession();
        call.resolve();
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        CredentialManager cm = CredentialManager.create(getContext());
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        cm.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            executor(),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (credential instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        try {
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            JSObject out = new JSObject();
                            out.put("idToken", google.getIdToken());
                            call.resolve(out);
                        } catch (RuntimeException e) {
                            call.reject("Google ID token could not be read", "bad_token");
                        }
                    } else {
                        call.reject("Unexpected credential type", "bad_credential");
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) call.reject("Sign-in was cancelled", "canceled");
                    else if (e instanceof NoCredentialException) call.reject("No Google account is available on this device", "no_account");
                    else call.reject("Google sign-in failed", "sign_in_failed");
                }
            }
        );
    }

    /** Forgets the chosen account on this device and clears the encrypted session store. */
    @PluginMethod
    public void signOut(PluginCall call) {
        clearEncryptedSession();
        CredentialManager cm = CredentialManager.create(getContext());
        cm.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            executor(),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    call.resolve();
                }

                @Override
                public void onError(@NonNull ClearCredentialException e) {
                    call.resolve(); // nothing to clear is fine
                }
            }
        );
    }
}
