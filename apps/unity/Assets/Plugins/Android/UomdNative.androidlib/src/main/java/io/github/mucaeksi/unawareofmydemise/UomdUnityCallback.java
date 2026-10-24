package io.github.mucaeksi.unawareofmydemise;

/**
 * Pure JNI callback interface bridged to Unity 6 C# via {@code AndroidJavaProxy}.
 * Zero Capacitor dependencies.
 */
public interface UomdUnityCallback {
    void onSuccess(String jsonPayload);
    void onError(String code, String message);
}
