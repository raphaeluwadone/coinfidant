import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ACCESS_COOKIE, TokensService } from "./tokens.service";
import { UsersService } from "./users.service";

const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export type AuthedRequest = Request & { userId: string };

export const UserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().userId,
);

/** Global: every route needs a valid access cookie unless marked @Public(). */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokensService) private readonly tokens: TokensService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = req.cookies?.[ACCESS_COOKIE];
    const userId = typeof token === "string" ? await this.tokens.verifyAccess(token) : null;
    // Access tokens are stateless, so a deleted account's token would otherwise work until it expires.
    if (!userId || !(await this.users.exists(userId))) throw new UnauthorizedException({ error: "unauthenticated" });
    req.userId = userId;
    return true;
  }
}
