import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AccessGuard } from "./auth.guard";
import { GoogleStrategy } from "./google.strategy";
import { TokensService } from "./tokens.service";
import { UsersService } from "./users.service";

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [TokensService, UsersService, GoogleStrategy, { provide: APP_GUARD, useClass: AccessGuard }],
  exports: [TokensService, UsersService],
})
export class AuthModule {}
