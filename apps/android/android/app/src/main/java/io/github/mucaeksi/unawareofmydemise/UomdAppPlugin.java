package io.github.mucaeksi.unawareofmydemise;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Process relaunch for the end of the first-install flow ("Restart &amp; Enter Game"): the game client closes and starts again so the
 * downloaded content is active from the first frame. Exactly one relaunch is performed however many times it is requested.
 */
@CapacitorPlugin(name = "UomdApp")
public class UomdAppPlugin extends Plugin {
    private static final AtomicBoolean RESTARTING = new AtomicBoolean(false);

    @PluginMethod
    public void restart(PluginCall call) {
        if (!RESTARTING.compareAndSet(false, true)) {
            call.resolve();
            return;
        }
        Context context = getContext();
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null || launch.getComponent() == null) {
            RESTARTING.set(false);
            call.reject("no launch intent");
            return;
        }
        // answer JS first, then relaunch on the main thread a moment later so the promise resolves before the process ends
        call.resolve();
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            context.startActivity(Intent.makeRestartActivityTask(launch.getComponent()));
            Runtime.getRuntime().exit(0);
        }, 250);
    }
}
