"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { validateProductUrl } from "@/lib/product-url";
import { discoverProducts } from "@/lib/discovery";
import { matchProducts, normalizeProductData } from "@/lib/products";
import { recordPriceObservation } from "@/lib/pricing";
import { enqueueTargetPriceNotifications } from "@/lib/alerts";
import { persistRecommendationForSource } from "@/lib/recommendations";
import { scrapeProduct as scrapeStructuredProduct } from "@/lib/scrapers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function normalizeAvailability(value) {
  const normalized = value?.toLowerCase() || "";

  if (/out of stock|sold out|unavailable|not available/.test(normalized)) {
    return "OUT_OF_STOCK";
  }

  if (/in stock|available|ready to ship/.test(normalized)) {
    return "IN_STOCK";
  }

  return "UNKNOWN";
}

function sourceFallbackKey(url) {
  return `source:${createHash("sha256").update(url).digest("hex")}`;
}

export async function addProduct(formData) {
  const urlValidation = validateProductUrl(formData.get("url"));

  if (!urlValidation.success) {
    return { error: urlValidation.error };
  }

  const url = urlValidation.data.url;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const admin = createAdminClient();
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const { data: stores, error: storesError } = await admin
      .from("stores")
      .select("id, name, domain")
      .eq("is_active", true);

    if (storesError) throw storesError;

    const store = (stores || []).find(
      (candidate) =>
        hostname === candidate.domain || hostname.endsWith(`.${candidate.domain}`)
    );

    if (!store) {
      return {
        error: "This store is not supported yet. Choose a result from a supported store."
      };
    }

    const productData = await scrapeStructuredProduct(url);

    if (!productData.name || productData.currentPrice === null) {
      return { error: "Could not extract product information from this URL" };
    }

    const normalized = normalizeProductData(productData);
    const canonicalKey = normalized.canonicalKey || sourceFallbackKey(url);
    const availability = normalizeAvailability(productData.availability);
    const currency = productData.currency || "INR";

    const { data: product, error: productError } = await admin
      .from("products")
      .upsert(
        {
          canonical_key: canonicalKey,
          name: normalized.name,
          brand: normalized.brand,
          model: normalized.model,
          category: normalized.category,
          image_url: productData.imageUrl,
          normalized_attributes: {
            storage: normalized.storage,
            color: normalized.color,
            variant: normalized.variant
          }
        },
        {
          onConflict: "canonical_key",
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (productError) throw productError;

    const { data: productSource, error: sourceError } = await admin
      .from("product_sources")
      .upsert(
        {
          product_id: product.id,
          store_id: store.id,
          url,
          source_name: productData.name,
          seller: productData.seller,
          availability,
          current_price: productData.currentPrice,
          currency,
          mrp: productData.mrp,
          discount_percentage:
            productData.mrp && productData.mrp > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    ((productData.mrp - productData.currentPrice) / productData.mrp) * 100
                  )
                )
              : null,
          image_url: productData.imageUrl,
          source_attributes: {
            provider: productData.provider,
            rating: productData.rating,
            reviewCount: productData.reviewCount,
            shipping: productData.shipping,
            extractedAt: productData.extractedAt
          }
        },
        { onConflict: "store_id,url", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (sourceError) throw sourceError;

    await recordPriceObservation(admin, {
      productSourceId: productSource.id,
      sourceUrl: url,
      price: productData.currentPrice,
      currency,
      availability,
      checkedAt: new Date().toISOString(),
      product: productData
    });

    try {
      await persistRecommendationForSource(admin, productSource.id);
    } catch (recommendationError) {
      console.error("Initial recommendation could not be created:", recommendationError);
    }

    const { error: trackingError } = await admin.from("tracked_products").upsert(
      { user_id: user.id, product_id: product.id, is_active: true },
      { onConflict: "user_id,product_id", ignoreDuplicates: false }
    );

    if (trackingError) throw trackingError;

    revalidatePath("/");
    return {
      success: true,
      product,
      message: "Product added to your PRISM dashboard."
    };
  } catch (error) {
    console.error("Add product error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

export async function searchProducts(formData) {
  const query = formData.get("query");

  if (typeof query !== "string" || query.trim().length < 2) {
    return { error: "Enter at least two characters to search." };
  }

  if (query.trim().length > 160) {
    return { error: "Product search must be 160 characters or fewer." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("name, domain")
      .eq("is_active", true);

    if (storesError) {
      throw storesError;
    }

    const candidates = await discoverProducts(query.trim(), stores || []);
    return { success: true, candidates };
  } catch (error) {
    console.error("Product search error:", error);
    return { error: error.message || "Unable to search for products." };
  }
}

function productIdentityForMatching(product) {
  const attributes =
    product.normalized_attributes && typeof product.normalized_attributes === "object"
      ? product.normalized_attributes
      : {};

  return normalizeProductData({
    sourceUrl: "",
    provider: "firecrawl",
    name: product.name,
    brand: product.brand,
    model: product.model,
    category: product.category,
    currentPrice: null,
    mrp: null,
    currency: null,
    imageUrl: product.image_url,
    rating: null,
    reviewCount: null,
    availability: null,
    seller: null,
    shipping: null,
    color: attributes.color || null,
    storage: attributes.storage || null,
    variant: attributes.variant || null,
    extractedAt: ""
  });
}

function discountPercentage(currentPrice, mrp) {
  if (!mrp || mrp <= 0) return null;

  return Math.max(0, Math.min(100, ((mrp - currentPrice) / mrp) * 100));
}

function normalizedText(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleConfirmsSameProduct(identity, candidate) {
  const candidateText = normalizedText(
    [candidate.title, candidate.description, candidate.productName].filter(Boolean).join(" ")
  );
  const accessoryTerms = [
    "case",
    "cover",
    "tempered glass",
    "screen protector",
    "charger",
    "charging cable",
    "adapter",
    "replacement",
    "back cover"
  ];

  if (!candidateText || accessoryTerms.some((term) => candidateText.includes(term))) {
    return false;
  }

  const brandTokens = normalizedText(identity.brand).split(" ").filter(Boolean);
  if (brandTokens.length === 0 || !brandTokens.every((token) => candidateText.includes(token))) {
    return false;
  }

  if (identity.storage) {
    const storagePattern = new RegExp(
      `\\b${identity.storage.replace(/([.*+?^${}()|[\]\\])/g, "\\$1").replace(/(gb|tb)$/i, "\\s*$1")}\\b`,
      "i"
    );
    if (!storagePattern.test(candidateText)) return false;
  }

  const modelTokens = normalizedText(identity.model || identity.name)
    .split(" ")
    .filter((token) => /[a-z]/.test(token) && /\d/.test(token));
  if (modelTokens.length === 0 || !modelTokens.some((token) => candidateText.includes(token))) {
    return false;
  }

  const colorTokens = normalizedText(identity.color).split(" ").filter(Boolean);
  return colorTokens.length === 0 || colorTokens.every((token) => candidateText.includes(token));
}

export async function compareStoreOffers(formData) {
  const productId = formData.get("productId");

  if (typeof productId !== "string" || !productId) {
    return { error: "Choose a tracked product before comparing stores." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    const { data: trackedProduct, error: trackedError } = await supabase
      .from("tracked_products")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("is_active", true)
      .maybeSingle();

    if (trackedError) throw trackedError;
    if (!trackedProduct) return { error: "You can only compare products you track." };

    const admin = createAdminClient();
    const [{ data: product, error: productError }, { data: stores, error: storesError }, { data: existingSources, error: sourcesError }] =
      await Promise.all([
        admin
          .from("products")
          .select("id, name, brand, model, category, image_url, normalized_attributes")
          .eq("id", productId)
          .single(),
        admin.from("stores").select("id, name, domain").eq("is_active", true),
        admin.from("product_sources").select("store_id").eq("product_id", productId)
      ]);

    if (productError || !product) throw productError || new Error("Product was not found.");
    if (storesError) throw storesError;
    if (sourcesError) throw sourcesError;

    const existingStoreIds = new Set((existingSources || []).map((source) => source.store_id));
    const remainingStores = (stores || []).filter((store) => !existingStoreIds.has(store.id));

    if (remainingStores.length === 0) {
      return { checked: 0, added: 0, potential: 0 };
    }

    const candidates = await discoverProducts(
      product.name.slice(0, 160),
      remainingStores.map(({ name, domain }) => ({ name, domain }))
    );
    const storesByDomain = new Map(
      remainingStores.map((store) => [store.domain.toLowerCase(), store])
    );
    const candidatesByStore = new Map();

    for (const candidate of candidates) {
      const hostname = new URL(candidate.url).hostname.replace(/^www\./, "").toLowerCase();
      const store = [...storesByDomain.entries()].find(
        ([domain]) => hostname === domain || hostname.endsWith(`.${domain}`)
      )?.[1];

      if (!store) continue;

      const selected = candidatesByStore.get(store.id) || [];
      // Two pages per store is a deliberate cap on external requests and credits.
      if (selected.length < 2) selected.push({ candidate, store });
      candidatesByStore.set(store.id, selected);
    }

    const identity = productIdentityForMatching(product);
    const results = { checked: 0, added: 0, potential: 0 };

    for (const selectedCandidates of candidatesByStore.values()) {
      let matchedStore = false;

      for (const { candidate, store } of selectedCandidates) {
        if (matchedStore) break;
        results.checked += 1;

        try {
          const productData = await scrapeStructuredProduct(candidate.url);
          if (productData.currentPrice === null) continue;

          const candidateProduct = {
            ...productData,
            name: productData.name || candidate.title
          };
          const normalizedCandidate = normalizeProductData(candidateProduct);
          const match = matchProducts(identity, normalizedCandidate);
          const titleFallbackMatch = titleConfirmsSameProduct(identity, {
            title: candidate.title,
            description: candidate.description,
            productName: candidateProduct.name
          });

          if (match.classification === "POTENTIAL_MATCH" && !titleFallbackMatch) {
            results.potential += 1;
            continue;
          }
          if (match.classification !== "SAME_PRODUCT" && !titleFallbackMatch) continue;

          const availability = normalizeAvailability(candidateProduct.availability);
          const currency = candidateProduct.currency || "INR";
          const { data: source, error: sourceError } = await admin
            .from("product_sources")
            .upsert(
              {
                product_id: productId,
                store_id: store.id,
                url: candidate.url,
                source_name: candidateProduct.name,
                seller: candidateProduct.seller,
                availability,
                current_price: candidateProduct.currentPrice,
                currency,
                mrp: candidateProduct.mrp,
                discount_percentage: discountPercentage(
                  candidateProduct.currentPrice,
                  candidateProduct.mrp
                ),
                image_url: candidateProduct.imageUrl,
                source_attributes: {
                  provider: candidateProduct.provider,
                  rating: candidateProduct.rating,
                  reviewCount: candidateProduct.reviewCount,
                  shipping: candidateProduct.shipping,
                  extractedAt: candidateProduct.extractedAt,
                  matchMethod: titleFallbackMatch ? "strict-title-fallback" : "structured-fields"
                },
                match_status: "MATCHED",
                match_confidence: titleFallbackMatch
                  ? Math.max(95, match.confidence)
                  : match.confidence
              },
              { onConflict: "store_id,url", ignoreDuplicates: false }
            )
            .select("id")
            .single();

          if (sourceError) throw sourceError;

          const observation = {
            productSourceId: source.id,
            sourceUrl: candidate.url,
            price: candidateProduct.currentPrice,
            currency,
            availability,
            checkedAt: new Date().toISOString(),
            product: candidateProduct
          };
          await recordPriceObservation(admin, observation);
          await enqueueTargetPriceNotifications(admin, observation);
          await persistRecommendationForSource(admin, source.id);
          results.added += 1;
          matchedStore = true;
        } catch (candidateError) {
          console.error(`Store comparison candidate failed for ${candidate.url}:`, candidateError);
        }
      }
    }

    revalidatePath("/");
    return results;
  } catch (error) {
    console.error("Compare store offers error:", error);
    return { error: error.message || "Unable to compare store offers." };
  }
}

export async function deleteProduct(productId) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) throw error;

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getProducts() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

export async function getDashboardData() {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return { trackedProducts: [], alerts: [], notifications: [], alertCount: 0 };
    }

    const [trackedResult, alertsResult, notificationsResult] = await Promise.all([
      supabase
        .from("tracked_products")
        .select(
          "id, created_at, product:products(id, name, brand, model, category, image_url, product_sources(id, url, current_price, currency, availability, last_checked_at, store:stores(name, slug, domain)), recommendations(buy_score, recommendation, confidence, reasoning, created_at))"
        )
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("price_alerts")
        .select("id, product_id, alert_type, target_price")
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("notifications")
        .select("id, channel, status, payload, sent_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3)
    ]);

    if (trackedResult.error) throw trackedResult.error;
    if (alertsResult.error) throw alertsResult.error;
    if (notificationsResult.error) throw notificationsResult.error;

    return {
      trackedProducts: trackedResult.data || [],
      alerts: alertsResult.data || [],
      notifications: notificationsResult.data || [],
      alertCount: alertsResult.data?.length || 0
    };
  } catch (error) {
    console.error("Get dashboard data error:", error);
    return { trackedProducts: [], alerts: [], notifications: [], alertCount: 0 };
  }
}

export async function getProductPriceHistory(productId) {
  if (typeof productId !== "string" || !productId) {
    return { error: "Choose a tracked product first." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    const { data: trackedProduct, error: trackedError } = await supabase
      .from("tracked_products")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("is_active", true)
      .maybeSingle();

    if (trackedError) throw trackedError;
    if (!trackedProduct) return { error: "You do not track this product." };

    const { data: sources, error: sourcesError } = await supabase
      .from("product_sources")
      .select("id")
      .eq("product_id", productId);

    if (sourcesError) throw sourcesError;
    const sourceIds = (sources || []).map((source) => source.id);
    if (sourceIds.length === 0) return { history: [] };

    const { data: history, error: historyError } = await supabase
      .from("price_history")
      .select("id, product_source_id, price, currency, availability, checked_at")
      .in("product_source_id", sourceIds)
      .order("checked_at", { ascending: true });

    if (historyError) throw historyError;
    return { history: history || [] };
  } catch (error) {
    console.error("Get product price history error:", error);
    return { error: error.message || "Unable to load price history." };
  }
}

export async function saveTargetPriceAlert(formData) {
  const productId = formData.get("productId");
  const targetPrice = Number(formData.get("targetPrice"));

  if (typeof productId !== "string" || !productId) {
    return { error: "Choose a product before creating an alert." };
  }

  if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 10000000) {
    return { error: "Enter a target price between ₹0.01 and ₹1,00,00,000." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    const { data: trackedProduct, error: trackedError } = await supabase
      .from("tracked_products")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("is_active", true)
      .maybeSingle();

    if (trackedError) throw trackedError;
    if (!trackedProduct) return { error: "You can only create alerts for products you track." };

    const { data: existingAlert, error: existingError } = await supabase
      .from("price_alerts")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("alert_type", "TARGET_REACHED")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    const alertValues = {
      user_id: user.id,
      product_id: productId,
      alert_type: "TARGET_REACHED",
      target_price: Math.round(targetPrice * 100) / 100,
      is_active: true
    };
    const { error } = existingAlert
      ? await supabase
          .from("price_alerts")
          .update(alertValues)
          .eq("id", existingAlert.id)
      : await supabase.from("price_alerts").insert(alertValues);

    if (error) throw error;

    // A user should not wait for the next scheduled scrape when the latest
    // recorded offer has already reached the target they just configured.
    const admin = createAdminClient();
    const { data: currentSources, error: sourcesError } = await admin
      .from("product_sources")
      .select("id, current_price, currency, availability")
      .eq("product_id", productId)
      .not("current_price", "is", null);

    if (sourcesError) throw sourcesError;

    let notificationsCreated = 0;
    for (const source of currentSources || []) {
      notificationsCreated += await enqueueTargetPriceNotifications(admin, {
        productSourceId: source.id,
        sourceUrl: "",
        price: Number(source.current_price),
        currency: source.currency,
        availability: source.availability,
        checkedAt: new Date().toISOString()
      });
    }

    revalidatePath("/");
    return {
      success: true,
      message:
        notificationsCreated > 0
          ? "Target already reached. An in-app notification was created."
          : existingAlert
            ? "Target price alert updated."
            : "Target price alert created."
    };
  } catch (error) {
    console.error("Save target price alert error:", error);
    return { error: error.message || "Unable to save the target price alert." };
  }
}

export async function getPriceHistory(productId) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", productId)
      .order("checked_at", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get price history error:", error);
    return [];
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}
