package io.github.mucaeksi.uomd;

import android.app.Activity;
import android.os.CancellationSignal;
import android.util.Log;

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

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Google sign-in through Android Credential Manager (LEGACY {@code GoogleSignInBridge}, adapted from polling to a
 * callback). The nonce is the single-use value issued by the game server ({@code POST /v1/auth/nonce}); Google mints
 * it into the ID token's {@code nonce} claim, which the server checks before it creates a session.
 *
 * <p>A returning player is signed in without a prompt: the first request only offers accounts that already signed in
 * to this app, with automatic selection. When there is none, a second request shows the account chooser. The ID
 * token is handed to the callback and never logged. One sign-in runs at a time.
 */
final class GoogleSignIn {
    static final String OK = "ok";
    static final String CANCELLED = "cancelled";
    static final String NO_ACCOUNT = "no_account";
    static final String ERROR = "error";

    private static final String TAG = "UomdNative";
    private static final AtomicBoolean running = new AtomicBoolean(false);

    /** What one sign-in produced: {@code idToken} is set only for {@link #OK}, {@code error} only for failures. */
    static final class Result {
        final String status;
        final String idToken;
        final String error;

        Result(String status, String idToken, String error) {
            this.status = status;
            this.idToken = idToken;
            this.error = error;
        }
    }

    interface Callback {
        void onFinished(Result result);
    }

    private GoogleSignIn() {}

    /** False when a sign-in is already running (nothing started, no callback); otherwise the callback runs once. */
    static boolean start(final Activity activity, final String serverClientId, final String nonce, final Callback callback) {
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        final Callback once = result -> {
            running.set(false);
            if (!OK.equals(result.status)) {
                Log.w(TAG, "sign-in " + result.status + ": " + result.error);
            }
            callback.onFinished(result);
        };
        activity.runOnUiThread(() -> {
            try {
                request(activity, serverClientId, nonce, true, once);
            } catch (Throwable t) {
                once.onFinished(new Result(ERROR, "", "start_failed: " + t.getClass().getSimpleName() + ": " + t.getMessage()));
            }
        });
        return true;
    }

    private static void request(
            final Activity activity, final String serverClientId, final String nonce, final boolean returningOnly, final Callback callback) {
        GetGoogleIdOption option = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(returningOnly)
                .setAutoSelectEnabled(returningOnly)
                .setServerClientId(serverClientId)
                .setNonce(nonce)
                .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager.create(activity).getCredentialAsync(
                activity,
                request,
                new CancellationSignal(),
                activity.getMainExecutor(),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        callback.onFinished(tokenOf(response.getCredential()));
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException error) {
                        if (error instanceof NoCredentialException && returningOnly) {
                            // No account signed in to this app before: ask the player to choose one.
                            request(activity, serverClientId, nonce, false, callback);
                        } else if (error instanceof GetCredentialCancellationException) {
                            callback.onFinished(new Result(CANCELLED, "", ""));
                        } else if (error instanceof NoCredentialException) {
                            callback.onFinished(new Result(NO_ACCOUNT, "", "no Google account on this device"));
                        } else {
                            callback.onFinished(new Result(ERROR, "", error.getType() + ": " + error.getMessage()));
                        }
                    }
                });
    }

    private static Result tokenOf(Credential credential) {
        if (!(credential instanceof CustomCredential)
                || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            return new Result(ERROR, "", "unexpected_credential_type");
        }
        try {
            return new Result(OK, GoogleIdTokenCredential.createFrom(((CustomCredential) credential).getData()).getIdToken(), "");
        } catch (Throwable t) {
            return new Result(ERROR, "", "bad_credential: " + t.getClass().getSimpleName());
        }
    }

    static void clearCredentialState(Activity activity) {
        CredentialManager.create(activity).clearCredentialStateAsync(
                new ClearCredentialStateRequest(),
                new CancellationSignal(),
                activity.getMainExecutor(),
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override
                    public void onResult(Void result) {}

                    @Override
                    public void onError(@NonNull ClearCredentialException error) {
                        Log.w(TAG, "clearCredentialState: " + error.getType());
                    }
                });
    }
}
