import { Inject, Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { type Profile, Strategy, type StrategyOptions } from "passport-google-oauth20";
import { CONFIG, type Config } from "../config";
import { CookieStateStore } from "./oauth-state.store";

export type ExternalIdentity = {
  provider: "google";
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(@Inject(CONFIG) config: Config) {
    // passport-oauth2 calls a PKCE store with (req, verifier, state, meta, cb); the typings only know the 2-3 arg form.
    const store = new CookieStateStore(config.JWT_SECRET, config.NODE_ENV === "production");
    super({
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: config.GOOGLE_CALLBACK_URL,
      scope: ["openid", "email", "profile"],
      pkce: true,
      state: true,
      store: store as unknown as StrategyOptions["store"],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): ExternalIdentity | false {
    const email = profile.emails?.[0];
    if (!email?.value) return false;
    return {
      provider: "google",
      providerUserId: profile.id,
      email: email.value.toLowerCase(),
      emailVerified: email.verified === true,
      displayName: profile.name?.givenName ?? profile.displayName ?? null,
    };
  }
}
