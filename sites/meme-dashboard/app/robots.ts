import type { MetadataRoute } from "next";

/**
 * robots.txt — disallow every user-agent.
 *
 * Belt-and-suspenders alongside the `metadata.robots` directive in
 * app/layout.tsx. The meta tag is enough for well-behaved crawlers
 * (Google, Bing, Naver, Daum); robots.txt also covers indexers that
 * skip rendering and only fetch the URL itself.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
