package com.getcapacitor.myapp;

import static org.junit.Assert.*;

import io.github.mucaeksi.unawareofmydemise.BuildConfig;
import io.github.mucaeksi.unawareofmydemise.UomdAdsPlugin;
import io.github.mucaeksi.unawareofmydemise.UomdBillingPlugin;
import io.github.mucaeksi.unawareofmydemise.UomdGoogleSignInPlugin;
import org.junit.Test;

/**
 * Host unit tests verifying BuildConfig and native plugin contract invariants for Unaware of My Demise.
 */
public class ExampleUnitTest {

    @Test
    public void buildConfigInvariants_areValid() {
        assertEquals("io.github.mucaeksi.unawareofmydemise", BuildConfig.APPLICATION_ID);
        assertTrue(BuildConfig.VERSION_CODE >= 1);
        assertNotNull(BuildConfig.GOOGLE_WEB_CLIENT_ID);
        assertTrue(BuildConfig.GOOGLE_WEB_CLIENT_ID.endsWith(".apps.googleusercontent.com"));
        assertNotNull(BuildConfig.REWARDED_UNIT_ID);
        assertTrue(BuildConfig.REWARDED_UNIT_ID.startsWith("ca-app-pub-"));
        if (!BuildConfig.DEBUG) {
            assertFalse(
                "Release builds must not use Google sample test AdMob unit ID",
                BuildConfig.REWARDED_UNIT_ID.contains("3940256099942544")
            );
        }
    }

    @Test
    public void nativePluginLifecycleHooks_areDeclared() throws Exception {
        assertNotNull(UomdGoogleSignInPlugin.class.getDeclaredMethod("handleOnDestroy"));
        assertNotNull(UomdBillingPlugin.class.getDeclaredMethod("handleOnDestroy"));
        assertNotNull(UomdAdsPlugin.class.getDeclaredMethod("handleOnDestroy"));
    }
}
