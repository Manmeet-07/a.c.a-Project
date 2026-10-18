import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { RequestError } from "./http";

/** Verify signed Firebase ID tokens; never trust a client-provided user ID. */
export async function requireUser(request: Request): Promise<string> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 10000)
    throw new RequestError(401, "Please sign in to continue.");
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId)
    throw new RequestError(503, "Account services are not configured yet.");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.FIREBASE_AUTH_EMULATOR_HOST
  )
    throw new RequestError(503, "Account services are misconfigured.");
  const app =
    getApps().find((app) => app.name === "aca-auth") ||
    initializeApp({ projectId }, "aca-auth");
  try {
    const decoded = await getAuth(app).verifyIdToken(header.slice(7));
    if (!decoded.email_verified)
      throw new RequestError(
        403,
        "Verify your email before using your workspace.",
      );
    return decoded.uid;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(
      401,
      "Your session has expired. Please sign in again.",
    );
  }
}
