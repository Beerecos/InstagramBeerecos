import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Les outils de la chaîne vidéo (automation/, .claude/) ne font pas partie du bundle web.
  outputFileTracingExcludes: { "*": [".claude/**", "rush/**", "export/**", "projets/**"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // Anciennes adresses françaises conservées (liens existants) vers la nouvelle navigation.
  async redirects() {
    return [
      { source: "/creer", destination: "/video", permanent: false },
      { source: "/creer/:mode", destination: "/video", permanent: false },
      { source: "/calendrier", destination: "/calendar", permanent: false },
      { source: "/medias", destination: "/library", permanent: false },
      { source: "/strategie", destination: "/brand", permanent: false },
      { source: "/reglages", destination: "/settings", permanent: false },
      { source: "/reglages/integrations", destination: "/settings/integrations", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
