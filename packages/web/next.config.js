/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "cdn.barbora.lt" },
      { protocol: "https", hostname: "rimibaltic-res.cloudinary.com" },
    ],
  },
};

module.exports = nextConfig;
