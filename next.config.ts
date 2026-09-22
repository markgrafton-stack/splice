import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@ffmpeg-installer/ffmpeg"],
};

export default nextConfig;
