package io.github.mucaeksi.unawareofmydemise;

import android.app.Activity;
import androidx.annotation.NonNull;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Pure Unity 6 JNI bridge for Google Play Billing v7.
 * Invoked directly from C# (UomdAndroidJniBridge.cs) with zero Capacitor dependencies.
 * All purchase grants and consumptions remain 100% server-authoritative on Cloudflare Workers.
 */
public final class UomdBillingBridge {
    private static BillingClient client;
    private static UomdUnityCallback activePurchaseCallback;

    private UomdBillingBridge() {}

    private static synchronized BillingClient getClient(Activity activity) {
        if (client == null) {
            client = BillingClient.newBuilder(activity.getApplicationContext())
                .setListener(UomdBillingBridge::onPurchasesUpdated)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        return client;
    }

    private interface ReadyAction {
        void run(BillingClient c);
    }

    private static void whenReady(Activity activity, UomdUnityCallback callback, ReadyAction then) {
        BillingClient c = getClient(activity);
        if (c.isReady()) {
            then.run(c);
            return;
        }
        c.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    then.run(c);
                } else {
                    callback.onError("billing_unavailable", "Google Play Billing is unavailable");
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Auto-reconnection enabled
            }
        });
    }

    private static String typeOf(String t) {
        return "subs".equals(t) ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP;
    }

    public static void purchase(
        Activity activity,
        String productId,
        String type,
        String accountTag,
        String requestedOfferToken,
        UomdUnityCallback callback
    ) {
        if (productId == null || productId.isEmpty() || accountTag == null || accountTag.isEmpty()) {
            callback.onError("bad_request", "productId and accountTag required");
            return;
        }
        synchronized (UomdBillingBridge.class) {
            if (activePurchaseCallback != null) {
                callback.onError("busy", "Another purchase is in progress");
                return;
            }
        }
        whenReady(activity, callback, c -> {
            List<QueryProductDetailsParams.Product> prodList = new ArrayList<>();
            prodList.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(typeOf(type))
                    .build()
            );
            QueryProductDetailsParams q = QueryProductDetailsParams.newBuilder().setProductList(prodList).build();
            c.queryProductDetailsAsync(q, (r, result) -> {
                List<ProductDetails> list = result.getProductDetailsList();
                if (list.isEmpty()) {
                    callback.onError("unknown_product", "This product is not available in Google Play");
                    return;
                }
                BillingFlowParams.ProductDetailsParams.Builder pd = BillingFlowParams.ProductDetailsParams
                    .newBuilder()
                    .setProductDetails(list.get(0));
                if ("subs".equals(type)) {
                    List<ProductDetails.SubscriptionOfferDetails> offers = list.get(0).getSubscriptionOfferDetails();
                    if (offers == null || offers.isEmpty()) {
                        callback.onError("no_offer", "No subscription offer is available");
                        return;
                    }
                    String tokenToUse = (requestedOfferToken != null && !requestedOfferToken.isEmpty())
                        ? requestedOfferToken
                        : offers.get(0).getOfferToken();
                    pd.setOfferToken(tokenToUse);
                }
                List<BillingFlowParams.ProductDetailsParams> paramsList = new ArrayList<>();
                paramsList.add(pd.build());
                BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(paramsList)
                    .setObfuscatedAccountId(accountTag)
                    .build();
                synchronized (UomdBillingBridge.class) {
                    activePurchaseCallback = callback;
                }
                activity.runOnUiThread(() -> {
                    BillingResult launch = c.launchBillingFlow(activity, flow);
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        UomdUnityCallback cb;
                        synchronized (UomdBillingBridge.class) {
                            cb = activePurchaseCallback;
                            activePurchaseCallback = null;
                        }
                        if (cb != null) {
                            cb.onError("launch_failed", "Could not open Google Play");
                        }
                    }
                });
            });
        });
    }

    private static void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        UomdUnityCallback cb;
        synchronized (UomdBillingBridge.class) {
            cb = activePurchaseCallback;
            activePurchaseCallback = null;
        }
        if (cb == null) return;
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            cb.onError("canceled", "Purchase was cancelled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            cb.onError("already_owned", "You already own this item; it will be restored");
        } else if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            cb.onError("purchase_failed", "Purchase failed");
        } else {
            try {
                cb.onSuccess(describePurchase(purchases.get(0)).toString());
            } catch (Exception e) {
                cb.onError("parse_error", "Could not encode purchase result");
            }
        }
    }

    private static JSONObject describePurchase(Purchase p) throws Exception {
        JSONObject o = new JSONObject();
        o.put("productId", p.getProducts().isEmpty() ? "" : p.getProducts().get(0));
        o.put("purchaseToken", p.getPurchaseToken());
        o.put("state", p.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "purchased");
        return o;
    }

    public static void queryOwnedPurchases(Activity activity, UomdUnityCallback callback) {
        whenReady(activity, callback, c -> {
            JSONArray out = new JSONArray();
            int[] left = { 2 };
            Runnable done = () -> {
                synchronized (left) {
                    if (--left[0] == 0) {
                        try {
                            JSONObject wrapper = new JSONObject();
                            wrapper.put("purchases", out);
                            callback.onSuccess(wrapper.toString());
                        } catch (Exception e) {
                            callback.onError("parse_error", "Could not serialize owned purchases");
                        }
                    }
                }
            };
            for (String t : new String[] { BillingClient.ProductType.INAPP, BillingClient.ProductType.SUBS }) {
                c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(t).build(), (r, list) -> {
                    synchronized (out) {
                        for (Purchase p : list) {
                            try {
                                out.put(describePurchase(p));
                            } catch (Exception ignored) {}
                        }
                    }
                    done.run();
                });
            }
        });
    }
}
