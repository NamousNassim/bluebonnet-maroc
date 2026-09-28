import { loadConfig } from "../src/config/app-config";

const base = { DATABASE_URL: "postgresql://x:y@localhost/z" };

describe("configuration", () => {
  it("validates management settings even while the stock integration is disabled", () => {
    expect(() => loadConfig({ ...base, BLUEBONNET_MANAGEMENT_ENABLED: "true" })).toThrow(/BLUEBONNET_MANAGEMENT_CLIENT_SECRET/);
    expect(() => loadConfig({ ...base, BLUEBONNET_MANAGEMENT_ENABLED: "true", BLUEBONNET_MANAGEMENT_CLIENT_SECRET: "short",
      BLUEBONNET_MANAGEMENT_ORGANIZATION_ID: "0b8d7c3e-5f1a-4d2b-9c6e-111111111111" })).toThrow(/at least 32/);
    expect(() => loadConfig({ ...base, BLUEBONNET_MANAGEMENT_ENABLED: "true", BLUEBONNET_MANAGEMENT_CLIENT_SECRET: "a".repeat(64) }))
      .toThrow(/BLUEBONNET_MANAGEMENT_ORGANIZATION_ID/);
  });

  it("defaults to the dedicated management identity and keeps management off by default", () => {
    const config = loadConfig({ ...base, BLUEBONNET_MANAGEMENT_ENABLED: "true", BLUEBONNET_MANAGEMENT_CLIENT_SECRET: "a".repeat(64),
      BLUEBONNET_MANAGEMENT_ORGANIZATION_ID: "0b8d7c3e-5f1a-4d2b-9c6e-111111111111" });
    expect(config.BLUEBONNET_MANAGEMENT_CLIENT_ID).toBe("startentreprise-bluebonnet-management");
    expect(loadConfig(base).BLUEBONNET_MANAGEMENT_ENABLED).toBe(false);
  });

  it("still validates the stock integration when it is enabled", () => {
    expect(() => loadConfig({ ...base, STARTENTREPRISE_INTEGRATION_ENABLED: "true" })).toThrow(/STARTENTREPRISE_API_URL/);
  });
});
