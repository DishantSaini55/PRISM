"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { validateProductUrl } from "@/lib/product-url";
import { discoverProducts } from "@/lib/discovery";
import { normalizeProductData } from "@/lib/products";
import { recordPriceObservation } from "@/lib/pricing";
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

    if (!user) return { trackedProducts: [], alerts: [], alertCount: 0 };

    const [trackedResult, alertsResult] = await Promise.all([
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
        .eq("is_active", true)
    ]);

    if (trackedResult.error) throw trackedResult.error;
    if (alertsResult.error) throw alertsResult.error;

    return {
      trackedProducts: trackedResult.data || [],
      alerts: alertsResult.data || [],
      alertCount: alertsResult.data?.length || 0
    };
  } catch (error) {
    console.error("Get dashboard data error:", error);
    return { trackedProducts: [], alerts: [], alertCount: 0 };
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

    revalidatePath("/");
    return {
      success: true,
      message: existingAlert ? "Target price alert updated." : "Target price alert created."
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
