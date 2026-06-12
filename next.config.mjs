import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Blog posts are authored as .mdx pages under app/blog/.
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

const withMDX = createMDX({
  // GFM enables the markdown tables used in posts.
  options: { remarkPlugins: [remarkGfm] },
});

export default withMDX(nextConfig);
