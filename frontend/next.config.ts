import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve("buffer/"),
        encoding: false,
        fs: false,
        readline: false,
        path: false,
        os: false,
        constants: false,
        stream: false,
        crypto: false,
      };
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        })
      );
    } else {
      config.externals.push("encoding");
    }
    return config;
  },
};

export default nextConfig;
