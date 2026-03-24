/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  
  // Ensure maximum compatibility with older browsers (WebOS TV)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Optimize for production
  productionBrowserSpeedInsights: false,
  
  // Disable strict mode for better performance on TV browsers
  reactStrictMode: false,
};

export default nextConfig;
