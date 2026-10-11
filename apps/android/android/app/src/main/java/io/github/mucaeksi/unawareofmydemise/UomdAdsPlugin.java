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
    private RewardedAd loaded;

    private ConsentInformation consent() {
        return UserMessagingPlatform.getConsentInformation(getContext());
    }

    private void startSdk() {
        if (!initialised.compareAndSet(false, true)) return;
        MobileAds.setRequestConfiguration(
            new RequestConfiguration.Builder()
                // conservative defaults: teen content ceiling; the age of consent is not assumed (UMP decides)
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_T)
                .build()
        );
        new Thread(() -> MobileAds.initialize(getContext(), status -> { })).start();
    }

    private JSObject state() {
        ConsentInformation ci = consent();
        JSObject o = new JSObject();
        o.put("canRequestAds", ci.canRequestAds());
        o.put("privacyOptionsRequired", ci.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        return o;
    }

    /** Runs the UMP consent flow (shows the form when the user's region requires it), then starts the ads SDK if consent allows. */
    @PluginMethod
    public void init(PluginCall call) {
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        getActivity().runOnUiThread(() ->
            consent().requestConsentInfoUpdate(
                getActivity(),
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(getActivity(), formError -> {
                    if (consent().canRequestAds()) startSdk();
                    call.resolve(state());
                }),
                requestError -> {
                    // offline or the consent service is down: remember the last known consent
                    if (consent().canRequestAds()) startSdk();
                    call.resolve(state());
                }
            )
        );
    }

    /** Re-opens the consent choices (a settings entry is required where privacy options are mandatory). */
    @PluginMethod
    public void showPrivacyOptions(PluginCall call) {
        getActivity().runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(getActivity(), formError -> call.resolve(state())));
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
        if (!consent().canRequestAds()) {
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
