/** Backend tests: unit tests plus integration tests against a throwaway PostgreSQL (Testcontainers). */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json", isolatedModules: false }] },
  testTimeout: 120000,
};
