package io.github.mucaeksi.unawareofmydemise;

import androidx.annotation.NonNull;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

/**
 * Google Play Billing bridge. The device only starts the purchase flow and reports the purchase token: the Worker verifies it with the
 * Google Play Developer API, grants exactly once, then acknowledges/consumes it server-side. Nothing granted here is trusted.
 */
@CapacitorPlugin(name = "UomdBilling")
public class UomdBillingPlugin extends Plugin {
    private BillingClient client;
    private PluginCall purchaseCall;

    private BillingClient client() {
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener((result, purchases) -> onPurchases(result, purchases))
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        return client;
    }

    private interface Ready {
        void run(BillingClient c);
    }

    private void whenReady(PluginCall call, Ready then) {
        BillingClient c = client();
        if (c.isReady()) {
            then.run(c);
            return;
        }
        c.startConnection(
            new com.android.billingclient.api.BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(@NonNull BillingResult r) {
                    if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) then.run(c);
                    else call.reject("Google Play Billing is unavailable", "billing_unavailable");
                }

                @Override
                public void onBillingServiceDisconnected() {
                    // auto reconnection is enabled; the next call reconnects
                }
            }
        );
    }

    private static String typeOf(String t) {
        return "subs".equals(t) ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP;
    }

    /** { products: [{ productId, type }] } -> { products: [{ productId, type, title, price, offerToken? }] } */
    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray wanted = call.getArray("products");
        if (wanted == null) {
            call.reject("products required", "bad_request");
            return;
        }
        whenReady(call, c -> {
            List<QueryProductDetailsParams.Product> inapp = new ArrayList<>();
            List<QueryProductDetailsParams.Product> subs = new ArrayList<>();
            try {
                for (int i = 0; i < wanted.length(); i++) {
                    JSObject p = JSObject.fromJSONObject(wanted.getJSONObject(i));
                    QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder().setProductId(p.getString("productId")).setProductType(typeOf(p.getString("type"))).build();
                    if ("subs".equals(p.getString("type"))) subs.add(product);
                    else inapp.add(product);
                }
            } catch (Exception e) {
                call.reject("bad products", "bad_request");
                return;
            }
            JSArray out = new JSArray();
            int[] pending = { (inapp.isEmpty() ? 0 : 1) + (subs.isEmpty() ? 0 : 1) };
            if (pending[0] == 0) {
                call.resolve(new JSObject().put("products", out));
                return;
            }
            Runnable done = () -> {
                synchronized (pending) {
                    if (--pending[0] == 0) call.resolve(new JSObject().put("products", out));
                }
            };
            for (List<QueryProductDetailsParams.Product> group : new List[] { inapp, subs }) {
                if (group.isEmpty()) continue;
                c.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(group).build(), (r, result) -> {
                    synchronized (out) {
                        for (ProductDetails d : result.getProductDetailsList()) {
                            JSObject o = new JSObject();
                            o.put("productId", d.getProductId());
                            o.put("type", BillingClient.ProductType.SUBS.equals(d.getProductType()) ? "subs" : "inapp");
                            o.put("title", d.getTitle());
                            if (d.getOneTimePurchaseOfferDetails() != null) o.put("price", d.getOneTimePurchaseOfferDetails().getFormattedPrice());
                            List<ProductDetails.SubscriptionOfferDetails> offers = d.getSubscriptionOfferDetails();
                            if (offers != null && !offers.isEmpty()) {
                                o.put("offerToken", offers.get(0).getOfferToken());
                                List<ProductDetails.PricingPhase> phases = offers.get(0).getPricingPhases().getPricingPhaseList();
                                if (!phases.isEmpty()) o.put("price", phases.get(phases.size() - 1).getFormattedPrice());
                            }
                            out.put(o);
                        }
                    }
                    done.run();
                });
            }
        });
    }

    /** { productId, type, accountTag } -> { productId, purchaseToken, state: 'purchased' | 'pending' } */
    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String type = call.getString("type", "inapp");
        String tag = call.getString("accountTag");
        if (productId == null || tag == null) {
            call.reject("productId and accountTag required", "bad_request");
            return;
        }
        if (purchaseCall != null) {
            call.reject("Another purchase is in progress", "busy");
            return;
        }
        whenReady(call, c -> {
            QueryProductDetailsParams q = QueryProductDetailsParams.newBuilder()
                .setProductList(List.of(QueryProductDetailsParams.Product.newBuilder().setProductId(productId).setProductType(typeOf(type)).build()))
                .build();
            c.queryProductDetailsAsync(q, (r, result) -> {
                List<ProductDetails> list = result.getProductDetailsList();
                if (list.isEmpty()) {
                    call.reject("This product is not available in Google Play", "unknown_product");
                    return;
                }
                BillingFlowParams.ProductDetailsParams.Builder pd = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(list.get(0));
                if ("subs".equals(type)) {
                    List<ProductDetails.SubscriptionOfferDetails> offers = list.get(0).getSubscriptionOfferDetails();
                    if (offers == null || offers.isEmpty()) {
                        call.reject("No subscription offer is available", "no_offer");
                        return;
                    }
                    pd.setOfferToken(offers.get(0).getOfferToken());
                }
                // binds the purchase to this game account (the server compares it with the player's tag)
                BillingFlowParams flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(List.of(pd.build())).setObfuscatedAccountId(tag).build();
                purchaseCall = call;
                getActivity().runOnUiThread(() -> {
                    BillingResult launch = c.launchBillingFlow(getActivity(), flow);
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        PluginCall pc = purchaseCall;
                        purchaseCall = null;
                        if (pc != null) pc.reject("Could not open Google Play", "launch_failed");
                    }
                });
            });
        });
    }

    private void onPurchases(BillingResult result, List<Purchase> purchases) {
        PluginCall call = purchaseCall;
        purchaseCall = null;
        if (call == null) return;
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("Purchase was cancelled", "canceled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            call.reject("You already own this item; it will be restored", "already_owned");
        } else if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            call.reject("Purchase failed", "purchase_failed");
        } else {
            call.resolve(describe(purchases.get(0)));
        }
    }

    private static JSObject describe(Purchase p) {
        JSObject o = new JSObject();
        o.put("productId", p.getProducts().isEmpty() ? "" : p.getProducts().get(0));
        o.put("purchaseToken", p.getPurchaseToken());
        o.put("state", p.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "purchased");
        return o;
    }

    /** Purchases Google still lists for this account (not yet consumed/acknowledged): the client re-submits them to the server (restore). */
    @PluginMethod
    public void owned(PluginCall call) {
        whenReady(call, c -> {
            JSArray out = new JSArray();
            int[] left = { 2 };
            Runnable done = () -> {
                synchronized (left) {
                    if (--left[0] == 0) call.resolve(new JSObject().put("purchases", out));
                }
            };
            for (String t : new String[] { BillingClient.ProductType.INAPP, BillingClient.ProductType.SUBS }) {
                c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(t).build(), (r, list) -> {
                    synchronized (out) {
                        for (Purchase p : list) out.put(describe(p));
                    }
                    done.run();
                });
            }
        });
    }
}
