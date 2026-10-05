package io.github.mucaeksi.uomd;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.godotengine.godot.Dictionary;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Rewarded ads (INF-036, DEC-0038): Google's consent form first (UMP, where the law asks for it), then one rewarded ad
 * at a time. The app never grants the reward: the ad carries the game account id for AdMob's server-side verification,
 * and the game server pays when AdMob calls it. The app only reports whether the ad was watched to the end.
 */
final class RewardedAds {
    private final AtomicBoolean initialized = new AtomicBoolean(false);
    private final AtomicBoolean showing = new AtomicBoolean(false);

    /** Emits {@code {"status": "ok" | "error", "can_request_ads", "error"}} after showing the consent form if required. */
    void consent(Activity activity, Consumer<Dictionary> report) {
        ConsentInformation consent = UserMessagingPlatform.getConsentInformation(activity);
        consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(),
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError ->
                        report.accept(consentPayload(consent, formError == null ? "" : formError.getMessage()))),
                requestError -> report.accept(consentPayload(consent, requestError.getMessage())));
    }

    private static Dictionary consentPayload(ConsentInformation consent, String error) {
        Dictionary payload = new Dictionary();
        payload.put("status", error.isEmpty() ? "ok" : "error");
        payload.put("can_request_ads", consent.canRequestAds());
        payload.put("privacy_options_required", privacyOptionsRequired(consent));
        payload.put("error", error);
        return payload;
    }

    private static boolean privacyOptionsRequired(ConsentInformation consent) {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    /**
     * Refreshes the consent information without showing any form and emits {@code {"status", "privacy_options_required",
     * "can_request_ads", "error"}}: whether Settings must offer "Ad privacy choices" (the player's way to change or
     * withdraw ad consent, which Google's EU user consent policy requires where consent was asked).
     */
    void privacyStatus(Activity activity, Consumer<Dictionary> report) {
        ConsentInformation consent = UserMessagingPlatform.getConsentInformation(activity);
        consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(),
                () -> report.accept(consentPayload(consent, "")),
                requestError -> report.accept(consentPayload(consent, requestError.getMessage())));
    }

    /** Shows Google's privacy options form; emits {@code {"status": "ok" | "error", "error"}} when it closes. */
    void showPrivacyOptions(Activity activity, Consumer<Dictionary> report) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> {
            Dictionary payload = new Dictionary();
            payload.put("status", formError == null ? "ok" : "error");
            payload.put("error", formError == null ? "" : formError.getMessage());
            report.accept(payload);
        });
    }

    /**
     * Loads and shows one rewarded ad of {@code adUnitId} for {@code accountId}. False when one is already showing;
     * otherwise exactly one report follows: {@code {"status": "rewarded" | "closed" | "failed", "error"}} ("closed": left
     * before the reward).
     */
    boolean show(Activity activity, String adUnitId, String accountId, Consumer<Dictionary> report) {
        if (!showing.compareAndSet(false, true)) {
            return false;
        }
        Consumer<Dictionary> once = payload -> {
            showing.set(false);
            report.accept(payload);
        };
        activity.runOnUiThread(() -> {
            if (initialized.compareAndSet(false, true)) {
                MobileAds.initialize(activity);
            }
            RewardedAd.load(activity, adUnitId, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    ad.setServerSideVerificationOptions(new ServerSideVerificationOptions.Builder().setUserId(accountId).build());
                    AtomicBoolean earned = new AtomicBoolean(false);
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdDismissedFullScreenContent() {
                            once.accept(adPayload(earned.get() ? "rewarded" : "closed", ""));
                        }

                        @Override
                        public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                            once.accept(adPayload("failed", error.getMessage()));
                        }
                    });
                    ad.show(activity, reward -> earned.set(true));
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    once.accept(adPayload("failed", error.getMessage()));
                }
            });
        });
        return true;
    }

    private static Dictionary adPayload(String status, String error) {
        Dictionary payload = new Dictionary();
        payload.put("status", status);
        payload.put("error", error);
        return payload;
    }
}
