module.exports = {
  roots: ["<rootDir>/src"],
  testEnvironment: "jsdom",
  testMatch: ["**/*.{spec,test}.{ts,tsx}"],
  setupFiles: ["<rootDir>/scripts/jestPolyfills.cjs"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  resetMocks: true,
  transform: {
    "\\.(svg|png|jpe?g|gif|webp|ico)$": "<rootDir>/scripts/jestAssetTransform.cjs",
    "^.+\\.[cm]?[jt]sx?$": [
      "babel-jest",
      {
        babelrc: false,
        configFile: false,
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          ["@babel/preset-react", { runtime: "automatic" }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  // React Intl 12 and FormatJS are ESM; transform these actual dependencies,
  // rather than mocking translations or changing production module behavior.
  transformIgnorePatterns: [
    "[/\\\\]node_modules[/\\\\](?!(react-intl|intl-messageformat|@formatjs)[/\\\\])",
  ],
  moduleNameMapper: {
    "\\.(css|scss|sass)$": "<rootDir>/scripts/jestAssetMock.cjs",
  },
};
