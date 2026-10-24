package io.github.mucaeksi.unawareofmydemise;

import android.app.Activity;
import androidx.annotation.NonNull;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/**
 * Pure Unity 6 JNI bridge for Google UMP Consent and AdMob Rewarded Ads with Server-Side Verification (SSV).
 * Invoked directly from C# (UomdAndroidJniBridge.cs) with zero Capacitor dependencies.
 */
public final class UomdAdsBridge {
    private static final AtomicBoolean INITIALISED = new AtomicBoolean(false);
    private static volatile boolean underAgeOfConsent = false;
    private static volatile boolean consentWithdrawn = false;
    private static RewardedAd loadedAd;

    private UomdAdsBridge() {}

    private static ConsentInformation consent(Activity activity) {
        return UserMessagingPlatform.getConsentInformation(activity.getApplicationContext());
    }

    private static void applyRequestConfiguration() {
        MobileAds.setRequestConfiguration(
            new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_T)
                .setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE)
                .setTagForUnderAgeOfConsent(
                    underAgeOfConsent
                        ? RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
                        : RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE
                )
                .build()
        );
    }

    private static void startSdk(Activity activity) {
        applyRequestConfiguration();
        if (!INITIALISED.compareAndSet(false, true)) return;
        new Thread(() -> MobileAds.initialize(activity.getApplicationContext(), status -> {})).start();
    }

    private static boolean canRequestAdsNow(Activity activity) {
        if (consentWithdrawn || underAgeOfConsent) return false;
        return consent(activity).canRequestAds();
    }

    private static String mapConsentStatus(ConsentInformation ci) {
        if (consentWithdrawn) return "withdrawn";
        if (underAgeOfConsent) return "denied";
        int st = ci.getConsentStatus();
        if (st == ConsentInformation.ConsentStatus.OBTAINED) return "OBTAINED";
        if (st == ConsentInformation.ConsentStatus.NOT_REQUIRED) return "NOT_REQUIRED";
        if (st == ConsentInformation.ConsentStatus.REQUIRED) return "REQUIRED";
        return "UNKNOWN";
    }

    private static String buildStateJson(Activity activity) {
        try {
            ConsentInformation ci = consent(activity);
            boolean allowed = canRequestAdsNow(activity);
            if (!allowed) loadedAd = null;
            JSONObject o = new JSONObject();
            o.put("canRequestAds", allowed);
            o.put("privacyOptionsRequired",
                ci.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
            o.put("status", mapConsentStatus(ci));
            o.put("underAgeOfConsent", underAgeOfConsent);
            o.put("childDirected", false);
            o.put("maxAdContentRating", "T");
            return o.toString();
        } catch (Exception e) {
            return "{\"canRequestAds\":false,\"status\":\"UNKNOWN\"}";
        }
    }

    public static void initConsent(Activity activity, boolean isUnderAge, UomdUnityCallback callback) {
        underAgeOfConsent = isUnderAge;
        applyRequestConfiguration();
        ConsentRequestParameters params = new ConsentRequestParameters.Builder()
            .setTagForUnderAgeOfConsent(underAgeOfConsent)
            .build();
        activity.runOnUiThread(() ->
            consent(activity).requestConsentInfoUpdate(
                activity,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
                    if (canRequestAdsNow(activity)) startSdk(activity);
                    else loadedAd = null;
                    callback.onSuccess(buildStateJson(activity));
                }),
                requestError -> {
                    if (canRequestAdsNow(activity)) startSdk(activity);
                    else loadedAd = null;
                    callback.onSuccess(buildStateJson(activity));
                }
            )
        );
    }

    public static void showRewardedAd(
        Activity activity,
        String adUnitId,
        String userId,
        String customData,
        UomdUnityCallback callback
    ) {
        if (userId == null || userId.isEmpty() || customData == null || customData.isEmpty()) {
            callback.onError("bad_request", "userId and customData required");
            return;
        }
        if (!canRequestAdsNow(activity)) {
            loadedAd = null;
            callback.onError("no_consent", "Ads are not allowed until consent is given");
            return;
        }
        startSdk(activity);
        activity.runOnUiThread(() ->
            RewardedAd.load(
                activity.getApplicationContext(),
                adUnitId,
                new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        if (!canRequestAdsNow(activity)) {
                            loadedAd = null;
                            callback.onError("no_consent", "Ads are not allowed until consent is given");
                            return;
                        }
                        loadedAd = ad;
                        ad.setServerSideVerificationOptions(
                            new ServerSideVerificationOptions.Builder()
                                .setUserId(userId)
                                .setCustomData(customData)
                                .build()
                        );
                        AtomicBoolean earned = new AtomicBoolean(false);
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override
                            public void onAdDismissedFullScreenContent() {
                                loadedAd = null;
                                callback.onSuccess("{\"earned\":" + earned.get() + "}");
                            }

                            @Override
                            public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                                loadedAd = null;
                                callback.onError("show_failed", "The ad could not be shown");
                            }
                        });
                        ad.show(activity, reward -> earned.set(true));
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError e) {
                        callback.onError("no_fill", "No ad is available right now");
                    }
                }
            )
        );
    }
}
