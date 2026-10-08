package io.github.mucaeksi.uomd;

import android.app.Activity;
import android.content.Context;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.godotengine.godot.Dictionary;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/**
 * Google Play Billing for the Eclipse Blessing subscription (INF-036, DEC-0038), Play Billing Library 9.
 *
 * <p>The app never grants anything: a purchase's token goes to the game server, which asks Google Play, pays, and
 * acknowledges it. This class only shows Play's purchase sheet and reports what Play answered. Every purchase carries
 * the game account id as Play's obfuscated account id, so the server can refuse a purchase used by another account and
 * bind one the app never reported.
 */
final class PlayBilling {
    private final BillingClient client;
    private final Consumer<Dictionary> onPurchasesUpdated;
    private final List<ProductDetails> products = new ArrayList<>();

    PlayBilling(Context context, Consumer<Dictionary> onPurchasesUpdated) {
        this.onPurchasesUpdated = onPurchasesUpdated;
        this.client = BillingClient.newBuilder(context)
                .setListener((result, purchases) -> onPurchasesUpdated.accept(purchasesPayload(result, purchases)))
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().enablePrepaidPlans().build())
                .enableAutoServiceReconnection()
                .build();
    }

    /** Runs {@code then} once Play's billing service is connected, or reports why it is not. */
    private void connected(Consumer<Dictionary> report, Runnable then) {
        if ((client.getConnectionState() == BillingClient.ConnectionState.CONNECTED)) {
            then.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    then.run();
                } else {
                    report.accept(error("billing unavailable: " + result.getDebugMessage(), result.getResponseCode()));
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // enableAutoServiceReconnection reconnects on the next call.
            }
        });
    }

    /** Emits {@code {"status": "ok", "product_id", "title", "price", "offer_token"}} or an error for one subscription. */
    void queryProduct(String productId, Consumer<Dictionary> report) {
        connected(report, () -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(productId)
                            .setProductType(BillingClient.ProductType.SUBS)
                            .build()))
                    .build();
            client.queryProductDetailsAsync(params, (result, details) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || details.getProductDetailsList().isEmpty()) {
                    report.accept(error("product not found: " + result.getDebugMessage(), result.getResponseCode()));
                    return;
                }
                ProductDetails product = details.getProductDetailsList().get(0);
                synchronized (products) {
                    products.removeIf(existing -> existing.getProductId().equals(product.getProductId()));
                    products.add(product);
                }
                List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
                Dictionary payload = new Dictionary();
                payload.put("status", "ok");
                payload.put("product_id", product.getProductId());
                payload.put("title", product.getName());
                if (offers != null && !offers.isEmpty()) {
                    ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
                    payload.put("offer_token", offer.getOfferToken());
                    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                    payload.put("price", phases.isEmpty() ? "" : phases.get(phases.size() - 1).getFormattedPrice());
                } else {
                    payload.put("offer_token", "");
                    payload.put("price", "");
                }
                report.accept(payload);
            });
        });
    }

    /**
     * Shows Play's purchase sheet for a product queried before. The outcome arrives through the purchases-updated
     * listener. False when the product was not queried or the sheet could not open.
     */
    boolean purchase(Activity activity, String productId, String offerToken, String accountId) {
        ProductDetails product = null;
        synchronized (products) {
            for (ProductDetails candidate : products) {
                if (candidate.getProductId().equals(productId)) {
                    product = candidate;
                }
            }
        }
        if (product == null || !(client.getConnectionState() == BillingClient.ConnectionState.CONNECTED)) {
            return false;
        }
        BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(product)
                        .setOfferToken(offerToken)
                        .build()))
                .setObfuscatedAccountId(accountId)
                .build();
        BillingResult result = client.launchBillingFlow(activity, params);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            onPurchasesUpdated.accept(error("purchase sheet: " + result.getDebugMessage(), result.getResponseCode()));
        }
        return true;
    }

    /** Emits the subscriptions Play holds for this Google account (to report one the app never could). */
    void queryPurchases(Consumer<Dictionary> report) {
        connected(report, () -> client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (result, purchases) -> report.accept(purchasesPayload(result, purchases))));
    }

    static Dictionary purchasesPayload(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            Dictionary payload = new Dictionary();
            payload.put("status", "cancelled");
            payload.put("purchases", new Object[0]);
            payload.put("error", "");
            return payload;
        }
        if (code != BillingClient.BillingResponseCode.OK) {
            return error(result.getDebugMessage(), code);
        }
        List<Dictionary> rows = new ArrayList<>();
        for (Purchase purchase : purchases == null ? Collections.<Purchase>emptyList() : purchases) {
            Dictionary row = new Dictionary();
            row.put("token", purchase.getPurchaseToken());
            row.put("products", purchase.getProducts().toArray(new String[0]));
            row.put("state", purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "purchased"
                    : purchase.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "unspecified");
            row.put("acknowledged", purchase.isAcknowledged());
            rows.add(row);
        }
        Dictionary payload = new Dictionary();
        payload.put("status", "ok");
        payload.put("purchases", rows.toArray());
        payload.put("error", "");
        return payload;
    }

    static Dictionary error(String message, int code) {
        Dictionary payload = new Dictionary();
        payload.put("status", "error");
        payload.put("purchases", new Object[0]);
        payload.put("error", message + " (" + code + ")");
        return payload;
    }

    void close() {
        client.endConnection();
    }
}
