import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  // Set when a TLS-terminating proxy does not forward X-Forwarded-Proto.
  if (process.env.FORCE_SECURE_COOKIES === "1") return true;
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/** Same-origin app: Lax is sufficient and avoids cross-site cookie sending. */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
