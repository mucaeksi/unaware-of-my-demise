package io.github.mucaeksi.unawareofmydemise;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Pure Unity 6 JNI bridge for atomic process relaunch after hot-patch activation.
 * Zero Capacitor dependencies.
 */
public final class UomdAppBridge {
    private static final AtomicBoolean RESTARTING = new AtomicBoolean(false);

    private UomdAppBridge() {}

    public static boolean restartApp(Activity activity) {
        if (!RESTARTING.compareAndSet(false, true)) {
            return true;
        }
        Context context = activity.getApplicationContext();
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null || launch.getComponent() == null) {
            RESTARTING.set(false);
            return false;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            context.startActivity(Intent.makeRestartActivityTask(launch.getComponent()));
            Runtime.getRuntime().exit(0);
        }, 250);
        return true;
    }
}
