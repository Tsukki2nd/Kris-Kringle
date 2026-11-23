/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app is fully client-side (Firestore talks directly from the browser),
  // so a static export works on Firebase Hosting, Vercel, or any static host.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
