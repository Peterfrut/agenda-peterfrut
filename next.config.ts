const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactCompiler: true,
  turbopack: {}, // <- importante no Next 16
};

module.exports = withPWA(nextConfig);
