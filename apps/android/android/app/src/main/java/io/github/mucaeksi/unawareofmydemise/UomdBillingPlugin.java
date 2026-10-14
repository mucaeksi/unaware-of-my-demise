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

    private synchronized BillingClient client() {
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener((result, purchases) -> onPurchases(result, purchases))
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        return client;
    }

    @Override
    protected void handleOnDestroy() {
        PluginCall pending;
        BillingClient active;
        synchronized (this) {
            pending = purchaseCall;
            purchaseCall = null;
            active = client;
            client = null;
        }
        if (pending != null) {
            pending.reject("Activity destroyed before purchase completed", "canceled");
        }
        if (active != null) {
            try {
                active.endConnection();
            } catch (Exception ignored) {
                // ignore teardown errors
            }
        }
        super.handleOnDestroy();
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

    /**
     * Supports both `{ inapp: string[], subs: string[] }` and `{ products: [{ productId, type }] }`.
     * Returns localized prices, base plans, subscription offers, and pricing phases.
     */
    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray inappIds = call.getArray("inapp");
        JSArray subsIds = call.getArray("subs");
        JSArray wanted = call.getArray("products");
        if (inappIds == null && subsIds == null && wanted == null) {
            call.reject("inapp/subs or products required", "bad_request");
            return;
        }
        whenReady(call, c -> {
            List<QueryProductDetailsParams.Product> inapp = new ArrayList<>();
            List<QueryProductDetailsParams.Product> subs = new ArrayList<>();
            try {
                if (inappIds != null) {
                    for (int i = 0; i < inappIds.length(); i++) {
                        String id = inappIds.getString(i);
                        if (id != null && !id.isEmpty()) {
                            inapp.add(
                                QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(id)
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build()
                            );
                        }
                    }
                }
                if (subsIds != null) {
                    for (int i = 0; i < subsIds.length(); i++) {
                        String id = subsIds.getString(i);
                        if (id != null && !id.isEmpty()) {
                            subs.add(
                                QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(id)
                                    .setProductType(BillingClient.ProductType.SUBS)
                                    .build()
                            );
                        }
                    }
                }
                if (wanted != null) {
                    for (int i = 0; i < wanted.length(); i++) {
                        JSObject p = JSObject.fromJSONObject(wanted.getJSONObject(i));
                        String pType = p.getString("type");
                        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(p.getString("productId"))
                            .setProductType(typeOf(pType))
                            .build();
                        if ("subs".equals(pType)) subs.add(product);
                        else inapp.add(product);
                    }
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
                            o.put("description", d.getDescription());
                            ProductDetails.OneTimePurchaseOfferDetails otp = d.getOneTimePurchaseOfferDetails();
                            if (otp != null) {
                                o.put("price", otp.getFormattedPrice());
                                o.put("formattedPrice", otp.getFormattedPrice());
                                o.put("priceAmountMicros", otp.getPriceAmountMicros());
                                o.put("priceCurrencyCode", otp.getPriceCurrencyCode());
                            }
                            List<ProductDetails.SubscriptionOfferDetails> offers = d.getSubscriptionOfferDetails();
                            if (offers != null && !offers.isEmpty()) {
                                JSArray offersJson = new JSArray();
                                for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                                    JSObject offerObj = new JSObject();
                                    offerObj.put("basePlanId", offer.getBasePlanId());
                                    String offerId = offer.getOfferId();
                                    offerObj.put("offerId", offerId == null ? JSObject.NULL : offerId);
                                    offerObj.put("offerToken", offer.getOfferToken());
                                    JSArray phasesJson = new JSArray();
                                    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                                    for (ProductDetails.PricingPhase phase : phases) {
                                        JSObject phaseObj = new JSObject();
                                        phaseObj.put("formattedPrice", phase.getFormattedPrice());
                                        phaseObj.put("priceAmountMicros", phase.getPriceAmountMicros());
                                        phaseObj.put("priceCurrencyCode", phase.getPriceCurrencyCode());
                                        phaseObj.put("billingPeriod", phase.getBillingPeriod());
                                        phaseObj.put("recurrenceMode", phase.getRecurrenceMode());
                                        phaseObj.put("billingCycleCount", phase.getBillingCycleCount());
                                        phasesJson.put(phaseObj);
                                    }
                                    offerObj.put("pricingPhases", phasesJson);
                                    offersJson.put(offerObj);
                                }
                                o.put("offers", offersJson);
                                o.put("offerToken", offers.get(0).getOfferToken());
                                List<ProductDetails.PricingPhase> firstPhases = offers.get(0).getPricingPhases().getPricingPhaseList();
                                if (!firstPhases.isEmpty()) {
                                    ProductDetails.PricingPhase recurring = firstPhases.get(firstPhases.size() - 1);
                                    o.put("price", recurring.getFormattedPrice());
                                    o.put("formattedPrice", recurring.getFormattedPrice());
                                    o.put("priceAmountMicros", recurring.getPriceAmountMicros());
                                    o.put("priceCurrencyCode", recurring.getPriceCurrencyCode());
                                }
                            }
                            out.put(o);
                        }
                    }
                    done.run();
                });
            }
        });
    }

    /** { productId, type, accountTag, offerToken?, basePlanId? } -> { productId, purchaseToken, state: 'purchased' | 'pending' } */
    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String type = call.getString("type", "inapp");
        String tag = call.getString("accountTag");
        String requestedOfferToken = call.getString("offerToken");
        String requestedBasePlanId = call.getString("basePlanId");
        if (productId == null || tag == null) {
            call.reject("productId and accountTag required", "bad_request");
            return;
        }
        synchronized (this) {
            if (purchaseCall != null) {
                call.reject("Another purchase is in progress", "busy");
                return;
            }
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
                    ProductDetails.SubscriptionOfferDetails chosen = null;
                    if (requestedOfferToken != null && !requestedOfferToken.isEmpty()) {
                        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                            if (requestedOfferToken.equals(offer.getOfferToken())) {
                                chosen = offer;
                                break;
                            }
                        }
                    } else if (requestedBasePlanId != null && !requestedBasePlanId.isEmpty()) {
                        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                            if (requestedBasePlanId.equals(offer.getBasePlanId())) {
                                chosen = offer;
                                break;
                            }
                        }
                    } else if (offers.size() == 1) {
                        chosen = offers.get(0);
                    } else {
                        call.reject("Multiple subscription offers exist; select an offerToken before launching checkout", "offer_selection_required");
                        return;
                    }
                    if (chosen == null) {
                        call.reject("Selected subscription offer is not available", "no_offer");
                        return;
                    }
                    pd.setOfferToken(chosen.getOfferToken());
                }
                // binds the purchase to this game account (the server compares it with the player's tag)
                BillingFlowParams flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(List.of(pd.build())).setObfuscatedAccountId(tag).build();
                synchronized (this) {
                    purchaseCall = call;
                }
                getActivity().runOnUiThread(() -> {
                    BillingResult launch = c.launchBillingFlow(getActivity(), flow);
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        PluginCall pc;
                        synchronized (UomdBillingPlugin.this) {
                            pc = purchaseCall;
                            purchaseCall = null;
                        }
                        if (pc != null) pc.reject("Could not open Google Play", "launch_failed");
                    }
                });
            });
        });
    }

    private void onPurchases(BillingResult result, List<Purchase> purchases) {
        PluginCall call;
        synchronized (this) {
            call = purchaseCall;
            purchaseCall = null;
        }
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            JSArray arr = new JSArray();
            for (Purchase p : purchases) arr.put(describe(p));
            notifyListeners("purchasesUpdated", new JSObject().put("purchases", arr));
        }
        if (call == null) return;
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
