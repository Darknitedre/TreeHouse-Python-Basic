/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Thumbnails come from arbitrary social CDNs; allow remote https images.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
