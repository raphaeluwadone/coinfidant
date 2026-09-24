import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CONFIG, type Config } from "../config";
import { Public, UserId } from "./auth.guard";
import type { ExternalIdentity } from "./google.strategy";
import { REFRESH_COOKIE, TokensService } from "./tokens.service";
import { UsersService } from "./users.service";

/** Passes failures through as a missing user so the callback can redirect instead of returning JSON. */
@Injectable()
class GoogleGuard extends AuthGuard("google") {
  getAuthenticateOptions() {
    return { session: false };
  }
  handleRequest<T>(_err: unknown, user: T) {
    return (user || null) as T;
  }
}

const AUTH_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(TokensService) private readonly tokens: TokensService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  @Public()
  @Throttle(AUTH_LIMIT)
  @UseGuards(GoogleGuard)
  @Get("google")
  google() {
    // Passport redirects to Google before this runs.
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @UseGuards(GoogleGuard)
  @Get("google/callback")
  async googleCallback(@Req() req: Request & { user: ExternalIdentity | null }, @Res() res: Response) {
    const web = this.config.WEB_ORIGIN;
    if (!req.user) return res.redirect(`${web}/login?error=google`);
    try {
      const user = await this.users.signIn(req.user);
      await this.tokens.setCookies(res, user.id, await this.tokens.issueRefresh(user.id));
      return res.redirect(`${web}/`);
    } catch {
      return res.redirect(`${web}/login?error=account`);
    }
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post("refresh")
  @HttpCode(204)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    const rotated = typeof token === "string" ? await this.tokens.rotate(token) : null;
    if (!rotated) {
      this.tokens.clearCookies(res);
      throw new UnauthorizedException({ error: "unauthenticated" });
    }
    await this.tokens.setCookies(res, rotated.userId, rotated.refresh);
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (typeof token === "string") await this.tokens.revoke(token);
    this.tokens.clearCookies(res);
  }

  @Get("me")
  async me(@UserId() userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException({ error: "unauthenticated" });
    return { user };
  }
}
