import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { randomBytes } from "node:crypto";

const COOKIE = "cf_oauth";
const PATH = "/api/auth/google";
const TTL_S = 10 * 60;

type Callback = (err: Error | null, ok?: string | false, state?: unknown) => void;

/**
 * passport-oauth2 state store that keeps the state handle and PKCE verifier in a signed, short-lived cookie,
 * so the API needs no server-side session. Google's redirect back is a top-level GET, so SameSite=Lax carries it.
 */
export class CookieStateStore {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly secure: boolean,
  ) {
    this.key = new TextEncoder().encode(`${secret}:oauth-state`);
  }

  store(
    req: Request,
    verifier: string,
    _state: unknown,
    _meta: unknown,
    cb: (err: Error | null, handle?: string) => void,
  ) {
    const handle = randomBytes(24).toString("base64url");
    new SignJWT({ h: handle, v: verifier })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(`${TTL_S}s`)
      .sign(this.key)
      .then((jwt) => {
        req.res!.cookie(COOKIE, jwt, {
          httpOnly: true,
          secure: this.secure,
          sameSite: "lax",
          path: PATH,
          maxAge: TTL_S * 1000,
        });
        cb(null, handle);
      }, cb);
  }

  verify(req: Request, providedState: string, cb: Callback) {
    const jwt = req.cookies?.[COOKIE];
    req.res!.clearCookie(COOKIE, { path: PATH });
    if (!jwt || typeof providedState !== "string") return cb(null, false, { message: "Missing OAuth state" });
    jwtVerify(jwt, this.key, { algorithms: ["HS256"] }).then(
      ({ payload }) =>
        payload.h === providedState && typeof payload.v === "string"
          ? cb(null, payload.v)
          : cb(null, false, { message: "OAuth state mismatch" }),
      () => cb(null, false, { message: "OAuth state expired or invalid" }),
    );
  }
}
