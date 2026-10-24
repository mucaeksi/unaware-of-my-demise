package io.github.mucaeksi.unawareofmydemise;

import android.app.Activity;
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
 * Pure Unity 6 JNI bridge for Android Credential Manager (Sign in with Google) and
 * AndroidKeyStore AES-256-GCM encrypted session persistence.
 * Invoked directly from C# (UomdAndroidJniBridge.cs) with zero Capacitor dependencies.
 */
public final class UomdGoogleSignInBridge {
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "uomd_session_key_v1";
    private static final String PREFS_FILE = "uomd.secure_session.v1";
    private static final String PREF_IV = "iv";
    private static final String PREF_CIPHERTEXT = "ct";
    private static final int GCM_TAG_BITS = 128;

    private static ExecutorService executor;

    private UomdGoogleSignInBridge() {}

    private static synchronized ExecutorService executor() {
        if (executor == null || executor.isShutdown() || executor.isTerminated()) {
            executor = Executors.newSingleThreadExecutor();
        }
        return executor;
    }

    private static SecretKey getOrCreateSecretKey() throws Exception {
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

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);
    }

    public static void clearSession(Activity activity) {
        prefs(activity).edit().remove(PREF_IV).remove(PREF_CIPHERTEXT).apply();
    }

    public static boolean writeSessionJson(Activity activity, String token, String expiresAt, String playerId) {
        if (token == null || token.isEmpty() || expiresAt == null || expiresAt.isEmpty()) {
            return false;
        }
        try {
            JSONObject payload = new JSONObject();
            payload.put("token", token);
            payload.put("expiresAt", expiresAt);
            if (playerId != null && !playerId.isEmpty()) {
                payload.put("playerId", playerId);
            }
            SecretKey key = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(payload.toString().getBytes(StandardCharsets.UTF_8));
            prefs(activity)
                .edit()
                .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(PREF_CIPHERTEXT, Base64.encodeToString(ct, Base64.NO_WRAP))
                .apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static String readSessionJson(Activity activity) {
        SharedPreferences sp = prefs(activity);
        String ivB64 = sp.getString(PREF_IV, null);
        String ctB64 = sp.getString(PREF_CIPHERTEXT, null);
        if (ivB64 == null || ctB64 == null) {
            return "{}";
        }
        try {
            SecretKey key = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
            byte[] ct = Base64.decode(ctB64, Base64.NO_WRAP);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            clearSession(activity);
            return "{}";
        }
    }

    public static void signIn(Activity activity, String serverClientId, UomdUnityCallback callback) {
        if (serverClientId == null || serverClientId.isEmpty()) {
            callback.onError("bad_request", "serverClientId required");
            return;
        }
        CredentialManager cm = CredentialManager.create(activity.getApplicationContext());
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(serverClientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        cm.getCredentialAsync(
            activity,
            request,
            new CancellationSignal(),
            executor(),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (credential instanceof CustomCredential &&
                        GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        try {
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            JSONObject out = new JSONObject();
                            out.put("idToken", google.getIdToken());
                            callback.onSuccess(out.toString());
                        } catch (Exception e) {
                            callback.onError("bad_token", "Google ID token could not be read");
                        }
                    } else {
                        callback.onError("bad_credential", "Unexpected credential type");
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        callback.onError("canceled", "Sign-in was cancelled");
                    } else if (e instanceof NoCredentialException) {
                        callback.onError("no_account", "No Google account is available on this device");
                    } else {
                        callback.onError("sign_in_failed", "Google sign-in failed");
                    }
                }
            }
        );
    }

    public static void signOut(Activity activity, UomdUnityCallback callback) {
        clearSession(activity);
        CredentialManager cm = CredentialManager.create(activity.getApplicationContext());
        cm.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            executor(),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    callback.onSuccess("{}");
                }

                @Override
                public void onError(@NonNull ClearCredentialException e) {
                    callback.onSuccess("{}");
                }
            }
        );
    }
}
