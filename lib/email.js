import { Resend } from "resend";

export async function sendPriceDropAlert(
  userEmail,
  product,
  oldPrice,
  newPrice
) {
  try {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.");
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const priceDrop = oldPrice - newPrice;
    const percentageDrop = ((priceDrop / oldPrice) * 100).toFixed(1);

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `🎉 Price Drop Alert: ${product.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="background: linear-gradient(135deg, #FA5D19 0%, #FF8C42 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Price Drop Alert!</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              
              ${
                product.image_url
                  ? `
                <div style="text-align: center; margin-bottom: 20px;">
                  <img src="${product.image_url}" alt="${product.name}" style="max-width: 200px; height: auto; border-radius: 8px; border: 1px solid #e5e7eb;">
                </div>
              `
                  : ""
              }
              
              <h2 style="color: #1f2937; margin-top: 0;">${product.name}</h2>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>Price dropped by ${percentageDrop}%!</strong>
                </p>
              </div>
              
              <table style="width: 100%; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; background: #f9fafb; border-radius: 4px;">
                    <div style="font-size: 14px; color: #6b7280;">Previous Price</div>
                    <div style="font-size: 20px; color: #9ca3af; text-decoration: line-through;">
                      ${product.currency} ${oldPrice.toFixed(2)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px;">
                    <div style="font-size: 14px; color: #6b7280;">Current Price</div>
                    <div style="font-size: 32px; color: #FA5D19; font-weight: bold;">
                      ${product.currency} ${newPrice.toFixed(2)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; background: #dcfce7; border-radius: 4px;">
                    <div style="font-size: 14px; color: #166534;">You Save</div>
                    <div style="font-size: 24px; color: #16a34a; font-weight: bold;">
                      ${product.currency} ${priceDrop.toFixed(2)}
                    </div>
                  </td>
                </tr>
              </table>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${product.url}" 
                   style="display: inline-block; background: #FA5D19; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View Product →
                </a>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
                <p>You're receiving this email because you're tracking this product on Price Tracker.</p>
                <p style="margin-top: 10px;">
                  <a href="${
                    process.env.NEXT_PUBLIC_APP_URL
                  }" style="color: #FA5D19; text-decoration: none;">
                    View All Tracked Products
                  </a>
                </p>
              </div>
            </div>
            
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Email error:", error);
    return { error: error.message };
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character]));
}

function formatPrice(value, currency) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currency || ""} ${value ?? ""}`.trim();
  }
}

function alertCopy(alertType) {
  return {
    TARGET_REACHED: ["Your target price was reached", "A tracked offer is now at or below the target you set."],
    PRICE_DROP: ["Price drop detected", "A tracked offer fell by your selected percentage."],
    BACK_IN_STOCK: ["Back in stock", "A tracked offer is available again."],
    ALL_TIME_LOW: ["New all-time low", "A tracked offer is lower than every earlier recorded price."],
  }[alertType] || ["Price update from PRISM", "A tracked offer has a new price update."];
}

export async function sendNotificationEmail({ to, payload, product, source }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.");
  }
  const resend = new Resend(apiKey);

  const [heading, description] = alertCopy(payload?.alert_type);
  const productName = escapeHtml(product?.name || "Tracked product");
  const price = formatPrice(payload?.price, payload?.currency);
  const sourceName = escapeHtml(source?.store?.name || "Store listing");
  const productUrl = source?.url || process.env.NEXT_PUBLIC_APP_URL || "https://example.com";
  const safeUrl = escapeHtml(productUrl);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `${heading}: ${product?.name || "your tracked product"}`,
    html: `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><main style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><div style="padding:24px;background:#4f46e5;color:#fff"><strong style="font-size:20px">PRISM</strong><div style="margin-top:10px;font-size:24px;font-weight:700">${escapeHtml(heading)}</div></div><div style="padding:24px"><p style="margin:0 0 12px">${escapeHtml(description)}</p><h1 style="font-size:20px;margin:0 0 8px">${productName}</h1><p style="color:#475569">${sourceName}</p><p style="font-size:28px;font-weight:700;margin:20px 0">${escapeHtml(price)}</p><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:700">View current offer</a><p style="margin-top:24px;color:#64748b;font-size:12px">You received this because you enabled price alerts in PRISM. Manage preferences in your account settings.</p></div></main></body></html>`,
  });
  if (error) throw new Error(error.message || "Resend rejected the email.");
  return data;
}
