package io.github.mucaeksi.unawareofmydemise;

import android.os.CancellationSignal;
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
import java.util.concurrent.Executors;

/**
 * Sign in with Google through Android Credential Manager. The only thing handed to JS is the Google ID token, which the game server
 * verifies (signature, issuer, audience, expiry) before it creates a session; nothing about the account is trusted from the device.
 */
@CapacitorPlugin(name = "UomdGoogleSignIn")
public class UomdGoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        CredentialManager cm = CredentialManager.create(getContext());
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        cm.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            Executors.newSingleThreadExecutor(),
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

    /** Forgets the chosen account on this device (the app session itself is revoked on the server by the client). */
    @PluginMethod
    public void signOut(PluginCall call) {
        CredentialManager cm = CredentialManager.create(getContext());
        cm.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            Executors.newSingleThreadExecutor(),
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
