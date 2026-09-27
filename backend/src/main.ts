import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { loadConfig } from "./config/app-config";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(cookieParser());
  // The storefront calls through its own origin; direct browser calls are only allowed from it.
  app.enableCors({ origin: [config.PUBLIC_SITE_URL], credentials: true });
  app.enableShutdownHooks();
  await app.listen(config.PORT, "0.0.0.0");
}

void bootstrap();
