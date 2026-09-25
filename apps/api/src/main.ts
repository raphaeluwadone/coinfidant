import "reflect-metadata";
import { ConsoleLogger, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { CONFIG, type Config } from "./config";
import { configureApp } from "./setup";

const prod = process.env.NODE_ENV === "production";
// One JSON object per line in production, so the host's log search can filter on fields.
const app = await NestFactory.create(AppModule, { logger: new ConsoleLogger({ json: prod, colors: !prod }) });
const config = app.get<Config>(CONFIG);
configureApp(app, config);
await app.listen(config.PORT, "0.0.0.0");
new Logger("main").log(`api listening on ${config.PORT}`);
