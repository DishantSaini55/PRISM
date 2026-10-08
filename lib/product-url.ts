export type ProductUrlValidationResult =
  | {
      success: true;
      data: {
        url: string;
        hostname: string;
      };
    }
  | {
      success: false;
      error: string;
    };

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    isPrivateIpv4(normalized)
  );
}

export function validateProductUrl(
  value: FormDataEntryValue | null
): ProductUrlValidationResult {
  if (typeof value !== "string" || !value.trim()) {
    return { success: false, error: "Enter a product URL." };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return { success: false, error: "Enter a valid URL." };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return {
      success: false,
      error: "Only HTTP and HTTPS product URLs are supported."
    };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return {
      success: false,
      error: "Product URLs must not contain credentials."
    };
  }

  if (isBlockedHostname(parsedUrl.hostname)) {
    return {
      success: false,
      error: "Local or private-network URLs are not allowed."
    };
  }

  parsedUrl.hash = "";

  return {
    success: true,
    data: {
      url: parsedUrl.toString(),
      hostname: parsedUrl.hostname.toLowerCase()
    }
  };
}
