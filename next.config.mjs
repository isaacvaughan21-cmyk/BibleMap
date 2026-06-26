import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Blog posts are authored as .mdx pages under app/blog/.
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // The Ask-Scripture server action reads the retrieval index and the corpus
  // off the filesystem at runtime. Next's tracer can't follow those dynamic
  // `fs` paths, so include them explicitly or the function 404s the files in
  // production (verify they land in the deployed Lambda, not just locally).
  experimental: {
    outputFileTracingIncludes: {
      "/app": ["./data/qa-index/**", "./public/bible/**"],
    },
  },
};

const withMDX = createMDX({
  // GFM enables the markdown tables used in posts.
  options: { remarkPlugins: [remarkGfm] },
});

export default withMDX(nextConfig);
