import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This repo has a second package-lock.json at its root (for the extension
  // build tools). Pin the workspace root to THIS folder so Next.js stops
  // guessing and warning about multiple lockfiles.
  outputFileTracingRoot: __dirname,
};
export default nextConfig;

