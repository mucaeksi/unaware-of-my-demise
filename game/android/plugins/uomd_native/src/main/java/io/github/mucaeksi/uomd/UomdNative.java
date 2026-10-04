package io.github.mucaeksi.uomd;

import android.app.Activity;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Log;

import androidx.annotation.NonNull;

import org.godotengine.godot.Dictionary;
import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.SignalInfo;
import org.godotengine.godot.plugin.UsedByGodot;

import java.security.KeyStore;
import java.util.HashSet;
import java.util.Set;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * UomdNative: the game's single custom Android plugin (migration brief 2.11).
 *
 * <p>AndroidKeyStore key wrapping, with exactly the design of the Kivy client's {@code AndroidKeystoreKeyProvider}:
 * a non-exportable AES-256-GCM key in the AndroidKeyStore wraps a random secret, and only the wrapped blob
 * {@code iv_length (1 byte) || iv || ciphertext+tag} is stored by the app.
 *
 * <p>Google sign-in through Credential Manager ({@link GoogleSignIn}, INF-017): {@link #signIn} starts it and the result
 * arrives as the {@code sign_in_finished} signal, never by polling. Play Billing and the rewarded ad are not built.
 *
 * <p>Methods never throw into the engine: they return {@code false} / an empty array and record the reason,
 * readable through {@link #lastError()}.
 */
public class UomdNative extends GodotPlugin {
    static final String PLUGIN_NAME = "UomdNative";
    static final String SIGN_IN_FINISHED = "sign_in_finished";
    private static final String TAG = "UomdNative";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;

    private String lastError = "";

    public UomdNative(Godot godot) {
        super(godot);
    }

    @Override
    public String getPluginName() {
        return PLUGIN_NAME;
    }

    @NonNull
    @Override
    public Set<SignalInfo> getPluginSignals() {
        Set<SignalInfo> signals = new HashSet<>();
        signals.add(new SignalInfo(SIGN_IN_FINISHED, Dictionary.class));
        return signals;
    }

    /**
     * Starts a Google sign-in for {@code serverClientId} (the game server's Web OAuth client) carrying the server-issued
     * {@code nonce}. Returns false when it cannot start (no activity, one already running); otherwise exactly one
     * {@code sign_in_finished} signal follows with {@code {"status": "ok" | "cancelled" | "no_account" | "error",
     * "id_token", "error"}}.
     */
    @UsedByGodot
    public boolean signIn(String serverClientId, String nonce) {
        Activity activity = getActivity();
        if (activity == null) {
            lastError = "signIn: no activity";
            return false;
        }
        boolean started = GoogleSignIn.start(activity, serverClientId, nonce, result -> {
            Dictionary payload = new Dictionary();
            payload.put("status", result.status);
            payload.put("id_token", result.idToken);
            payload.put("error", result.error);
            emitSignal(SIGN_IN_FINISHED, payload);
        });
        lastError = started ? "" : "signIn: a sign-in is already running";
        return started;
    }

    /** Forgets the signed-in account for automatic sign-in (logout); the next sign-in shows the account chooser. */
    @UsedByGodot
    public void clearCredentialState() {
        Activity activity = getActivity();
        if (activity != null) {
            GoogleSignIn.clearCredentialState(activity);
        }
    }

    /** The reason the previous call failed, or an empty string. */
    @UsedByGodot
    public String lastError() {
        return lastError;
    }

    @UsedByGodot
    public boolean hasKey(String alias) {
        try {
            return loadKeyStore().containsAlias(alias);
        } catch (Exception e) {
            return fail("hasKey", e, false);
        }
    }

    /** Creates the non-exportable AES-256-GCM wrapping key; no user authentication, keystore-chosen IVs. */
    @UsedByGodot
    public boolean createKey(String alias) {
        try {
            KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                    alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setKeySize(256)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setUserAuthenticationRequired(false)
                    .setRandomizedEncryptionRequired(true)
                    .build();
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
            generator.init(spec);
            generator.generateKey();
            lastError = "";
            return true;
        } catch (Exception e) {
            return fail("createKey", e, false);
        }
    }

    @UsedByGodot
    public boolean deleteKey(String alias) {
        try {
            loadKeyStore().deleteEntry(alias);
            lastError = "";
            return true;
        } catch (Exception e) {
            return fail("deleteKey", e, false);
        }
    }

    /** Wraps {@code plaintext}; returns {@code iv_length (1 byte) || iv || ciphertext+tag}, or an empty array on failure. */
    @UsedByGodot
    public byte[] wrap(String alias, byte[] plaintext) {
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey(alias));
            byte[] iv = cipher.getIV();
            byte[] sealed = cipher.doFinal(plaintext);
            byte[] blob = new byte[1 + iv.length + sealed.length];
            blob[0] = (byte) iv.length;
            System.arraycopy(iv, 0, blob, 1, iv.length);
            System.arraycopy(sealed, 0, blob, 1 + iv.length, sealed.length);
            lastError = "";
            return blob;
        } catch (Exception e) {
            return fail("wrap", e, new byte[0]);
        }
    }

    /** Reverses {@link #wrap}; an empty array on failure (wrong key, tampered blob, lost keystore entry). */
    @UsedByGodot
    public byte[] unwrap(String alias, byte[] blob) {
        try {
            if (blob == null || blob.length < 2) {
                throw new IllegalArgumentException("blob too short");
            }
            int ivLength = blob[0] & 0xFF;
            if (blob.length < 1 + ivLength + 1) {
                throw new IllegalArgumentException("blob shorter than its iv");
            }
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKey(alias), new GCMParameterSpec(GCM_TAG_BITS, blob, 1, ivLength));
            byte[] plain = cipher.doFinal(blob, 1 + ivLength, blob.length - 1 - ivLength);
            lastError = "";
            return plain;
        } catch (Exception e) {
            return fail("unwrap", e, new byte[0]);
        }
    }

    private static KeyStore loadKeyStore() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        return keyStore;
    }

    private static SecretKey secretKey(String alias) throws Exception {
        KeyStore keyStore = loadKeyStore();
        if (!keyStore.containsAlias(alias)) {
            throw new IllegalStateException("no keystore entry " + alias);
        }
        return (SecretKey) keyStore.getKey(alias, null);
    }

    private <T> T fail(String where, Exception e, T fallback) {
        lastError = where + ": " + e.getClass().getSimpleName() + ": " + e.getMessage();
        Log.w(TAG, lastError);
        return fallback;
    }
}
