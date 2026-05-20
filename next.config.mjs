/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@react-pdf/renderer"],
  experimental: {
    serverComponentsExternalPackages: [
      "@remotion/bundler",
      "@remotion/renderer",
      "@remotion/compositor-darwin-arm64",
      "@remotion/compositor-darwin-x64",
      "@remotion/compositor-linux-arm64-gnu",
      "@remotion/compositor-linux-arm64-musl",
      "@remotion/compositor-linux-x64-gnu",
      "@remotion/compositor-linux-x64-musl",
      "@remotion/compositor-win32-x64-msvc",
      "@rspack/core",
      "@rspack/binding-darwin-arm64",
      "@rspack/binding-darwin-x64",
      "@rspack/binding-linux-arm64-gnu",
      "@rspack/binding-linux-x64-gnu",
      "esbuild",
    ],
    // remotion/ est passé à @remotion/bundler via un chemin string
    // (lib/video-render.ts) : Next ne le trace pas statiquement, donc les
    // fichiers (Root.tsx, scenes/, assets/) manquent dans la fonction
    // serverless → "Can't resolve './Root' in /var/task/remotion". On force
    // leur inclusion dans le bundle de la route de génération vidéo.
    outputFileTracingIncludes: {
      "/api/generate-video": ["./remotion/**/*"],
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.node$/,
      loader: "node-loader",
    })
    return config
  },
}

export default nextConfig
