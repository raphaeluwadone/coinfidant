import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import { authIdentities, users } from "../db/schema";
import type { ExternalIdentity } from "./google.strategy";

export type PublicUser = { id: string; email: string; displayName: string | null };

const publicCols = { id: users.id, email: users.email, displayName: users.displayName };

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  findById(id: string): Promise<PublicUser | undefined> {
    return this.db
      .select(publicCols)
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then((r) => r[0]);
  }

  /** Signs in an existing identity, links a verified email to its account, or creates a new account. */
  async signIn(identity: ExternalIdentity): Promise<PublicUser> {
    return this.db.transaction(async (tx) => {
      const [linked] = await tx
        .select(publicCols)
        .from(authIdentities)
        .innerJoin(users, eq(users.id, authIdentities.userId))
        .where(
          and(
            eq(authIdentities.provider, identity.provider),
            eq(authIdentities.providerUserId, identity.providerUserId),
          ),
        )
        .limit(1);
      if (linked) return linked;

      let [user] = await tx.select(publicCols).from(users).where(eq(users.email, identity.email)).limit(1);
      if (user && !identity.emailVerified) throw new ConflictException({ error: "email_unverified" });
      if (!user) {
        [user] = await tx
          .insert(users)
          .values({ email: identity.email, displayName: identity.displayName })
          .returning(publicCols);
      }
      if (!user) throw new Error("user insert returned no row");

      await tx
        .insert(authIdentities)
        .values({ userId: user.id, provider: identity.provider, providerUserId: identity.providerUserId });
      return user;
    });
  }
}
