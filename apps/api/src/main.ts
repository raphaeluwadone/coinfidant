import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { CONFIG, type Config } from "./config";
import { configureApp } from "./setup";

const app = await NestFactory.create(AppModule);
const config = app.get<Config>(CONFIG);
configureApp(app, config);
await app.listen(config.PORT);
console.log(`api on http://localhost:${config.PORT}`);
