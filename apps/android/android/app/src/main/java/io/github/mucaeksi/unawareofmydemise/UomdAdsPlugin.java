package io.github.mucaeksi.unawareofmydemise;

import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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

/**
 * AdMob rewarded ads behind the Google UMP consent flow. Ads are only requested after consent allows it. The reward is NEVER minted on
 * the device: the view carries the player id and a one-time server nonce as server-side-verification options, and the game server pays
 * when Google's signed callback arrives.
 */
@CapacitorPlugin(name = "UomdAds")
public class UomdAdsPlugin extends Plugin {
    private final AtomicBoolean initialised = new AtomicBoolean(false);
    private volatile boolean underAgeOfConsent = false;
    private volatile boolean consentWithdrawn = false;
    private RewardedAd loaded;

    @Override
    protected void handleOnDestroy() {
        loaded = null;
        super.handleOnDestroy();
    }

    private ConsentInformation consent() {
        return UserMessagingPlatform.getConsentInformation(getContext());
    }

    private void applyRequestConfiguration() {
        MobileAds.setRequestConfiguration(
            new RequestConfiguration.Builder()
                // Explicit audience policy: teen content ceiling (13+ target audience), not child-directed, respects under-age-of-consent tag
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

    private void startSdk() {
        applyRequestConfiguration();
        if (!initialised.compareAndSet(false, true)) return;
        new Thread(() -> MobileAds.initialize(getContext(), status -> { })).start();
    }

    private String mapConsentStatus(ConsentInformation ci) {
        if (consentWithdrawn) return "withdrawn";
        if (underAgeOfConsent) return "denied";
        int st = ci.getConsentStatus();
        if (st == ConsentInformation.ConsentStatus.OBTAINED) return "OBTAINED";
        if (st == ConsentInformation.ConsentStatus.NOT_REQUIRED) return "NOT_REQUIRED";
        if (st == ConsentInformation.ConsentStatus.REQUIRED) return "REQUIRED";
        return "UNKNOWN";
    }

    private boolean canRequestAdsNow() {
        if (consentWithdrawn || underAgeOfConsent) return false;
        return consent().canRequestAds();
    }

    private JSObject state() {
        ConsentInformation ci = consent();
        boolean allowed = canRequestAdsNow();
        if (!allowed) loaded = null;
        JSObject o = new JSObject();
        o.put("canRequestAds", allowed);
        o.put("privacyOptionsRequired", ci.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        o.put("status", mapConsentStatus(ci));
        o.put("underAgeOfConsent", underAgeOfConsent);
        o.put("childDirected", false);
        o.put("maxAdContentRating", "T");
        return o;
    }

    /** Runs the UMP consent flow (shows the form when the user's region requires it), then starts the ads SDK if consent allows. */
    @PluginMethod
    public void init(PluginCall call) {
        Boolean underAgeArg = call.getBoolean("underAgeOfConsent");
        if (underAgeArg != null) underAgeOfConsent = underAgeArg;
        applyRequestConfiguration();
        ConsentRequestParameters params = new ConsentRequestParameters.Builder()
            .setTagForUnderAgeOfConsent(underAgeOfConsent)
            .build();
        getActivity().runOnUiThread(() ->
            consent().requestConsentInfoUpdate(
                getActivity(),
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(getActivity(), formError -> {
                    if (canRequestAdsNow()) startSdk();
                    else loaded = null;
                    call.resolve(state());
                }),
                requestError -> {
                    // offline or the consent service is down: remember the last known consent
                    if (canRequestAdsNow()) startSdk();
                    else loaded = null;
                    call.resolve(state());
                }
            )
        );
    }

    /** Re-opens the consent choices (a settings entry is required where privacy options are mandatory). */
    @PluginMethod
    public void showPrivacyOptions(PluginCall call) {
        Boolean withdrawArg = call.getBoolean("withdrawConsent");
        Boolean underAgeArg = call.getBoolean("underAgeOfConsent");
        if (underAgeArg != null) underAgeOfConsent = underAgeArg;
        if (Boolean.TRUE.equals(withdrawArg)) {
            consentWithdrawn = true;
            loaded = null;
        } else if (Boolean.FALSE.equals(withdrawArg)) {
            consentWithdrawn = false;
        }
        applyRequestConfiguration();
        getActivity().runOnUiThread(() ->
            UserMessagingPlatform.showPrivacyOptionsForm(
                getActivity(),
                formError -> {
                    if (!canRequestAdsNow()) loaded = null;
                    call.resolve(state());
                }
            )
        );
    }

    /** { userId, customData } -> { earned: boolean }. Resolves when the ad is closed. */
    @PluginMethod
    public void showRewarded(PluginCall call) {
        String userId = call.getString("userId");
        String customData = call.getString("customData");
        if (userId == null || customData == null) {
            call.reject("userId and customData required", "bad_request");
            return;
        }
        if (!canRequestAdsNow()) {
            loaded = null;
            call.reject("Ads are not allowed until consent is given", "no_consent");
            return;
        }
        startSdk();
        getActivity().runOnUiThread(() ->
            RewardedAd.load(
                getContext(),
                BuildConfig.REWARDED_UNIT_ID,
                new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        if (!canRequestAdsNow()) {
                            loaded = null;
                            call.reject("Ads are not allowed until consent is given", "no_consent");
                            return;
                        }
                        loaded = ad;
                        ad.setServerSideVerificationOptions(new ServerSideVerificationOptions.Builder().setUserId(userId).setCustomData(customData).build());
                        AtomicBoolean earned = new AtomicBoolean(false);
                        ad.setFullScreenContentCallback(
                            new FullScreenContentCallback() {
                                @Override
                                public void onAdDismissedFullScreenContent() {
                                    loaded = null;
                                    call.resolve(new JSObject().put("earned", earned.get()));
                                }

                                @Override
                                public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                                    loaded = null;
                                    call.reject("The ad could not be shown", "show_failed");
                                }
                            }
                        );
                        ad.show(getActivity(), reward -> earned.set(true));
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError e) {
                        call.reject("No ad is available right now", "no_fill");
                    }
                }
            )
        );
    }
}
