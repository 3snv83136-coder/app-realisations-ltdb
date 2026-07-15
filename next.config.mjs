/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@react-pdf/renderer",
      "@remotion/renderer",
      "@remotion/compositor-linux-x64-gnu",
      "@sparticuz/chromium",
    ],
    // Bundle Remotion précompilé au build (build/) — pas de @remotion/bundler en prod.
    outputFileTracingIncludes: {
      "/api/generate-video": [
        "./build/**/*",
        "./node_modules/@remotion/compositor-linux-x64-gnu/**/*",
        "./node_modules/@sparticuz/chromium/**/*",
      ],
    },
    outputFileTracingExcludes: {
      "/api/generate-video": [
        "./node_modules/.cache/**/*",
        "./node_modules/@remotion/bundler/**/*",
        "./node_modules/@remotion/studio/**/*",
        "./node_modules/@rspack/**/*",
        "./node_modules/webpack/**/*",
        "./node_modules/typescript/**/*",
        "./node_modules/terser/**/*",
        "./node_modules/@esbuild/**/*",
        "./node_modules/@remotion/compositor-linux-x64-musl/**/*",
        "./node_modules/@remotion/compositor-darwin-*/**/*",
        "./node_modules/@remotion/compositor-win32-*/**/*",
        "./remotion/**/*",
        // Ne pas exclure build/**/*.map : @remotion/renderer lit bundle.js.map au runtime.
      ],
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.node$/,
      loader: "node-loader",
    })
    return config
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Micro (dictée vocale) et caméra/géoloc restreints à l'app elle-même.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
        ],
      },
    ]
  },
}

export default nextConfig
