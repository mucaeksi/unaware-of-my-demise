package com.getcapacitor.myapp;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import io.github.mucaeksi.unawareofmydemise.BuildConfig;
import io.github.mucaeksi.unawareofmydemise.UomdAdsPlugin;
import io.github.mucaeksi.unawareofmydemise.UomdAppPlugin;
import io.github.mucaeksi.unawareofmydemise.UomdBillingPlugin;
import io.github.mucaeksi.unawareofmydemise.UomdGoogleSignInPlugin;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented test verifying the Unaware of My Demise package identity, BuildConfig invariants, and Capacitor native plugins.
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void useAppContextAndVerifyNativePlugins() throws Exception {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("io.github.mucaeksi.unawareofmydemise", appContext.getPackageName());
        assertNotNull(BuildConfig.GOOGLE_WEB_CLIENT_ID);
        assertTrue(BuildConfig.GOOGLE_WEB_CLIENT_ID.endsWith(".apps.googleusercontent.com"));
        assertNotNull(BuildConfig.REWARDED_UNIT_ID);
        assertTrue(BuildConfig.REWARDED_UNIT_ID.startsWith("ca-app-pub-"));
        assertNotNull(UomdGoogleSignInPlugin.class.getMethod("writeSession", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdGoogleSignInPlugin.class.getMethod("readSession", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdGoogleSignInPlugin.class.getMethod("clearSession", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdBillingPlugin.class.getMethod("getProducts", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdBillingPlugin.class.getMethod("purchase", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdBillingPlugin.class.getMethod("owned", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdAdsPlugin.class.getMethod("init", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdAdsPlugin.class.getMethod("showPrivacyOptions", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdAdsPlugin.class.getMethod("showRewarded", com.getcapacitor.PluginCall.class));
        assertNotNull(UomdAppPlugin.class);
    }
}
