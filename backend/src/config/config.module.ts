import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, loadConfig } from "./app-config";

/** Validated configuration, visible to every module (the StartEntreprise adapter included). */
@Global()
@Module({ providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }], exports: [APP_CONFIG] })
export class ConfigModule {}
