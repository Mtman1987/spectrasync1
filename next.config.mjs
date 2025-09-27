
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // This is necessary for some of the dependencies.
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // This is the crucial part. We are telling Webpack to not include these
    // server-side modules in the client-side bundle.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        process: false,
        stream: false,
        crypto: false, // Adding this as it's another common one.
      };
    }

    return config;
  },
};

export default nextConfig;
