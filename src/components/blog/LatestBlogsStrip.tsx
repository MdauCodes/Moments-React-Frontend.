import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { api } from "@/services/api";
import { BLOGS_ENABLED } from "@/config/features";
import { BlogCard } from "@/components/blog/BlogTemplates";
import type { Blog } from "@/data/blogs";
import { ArrowRight } from "lucide-react";

// Latest blogs strip — slotted just before the footer.
// Renders nothing when blogs are disabled; renders heading + whatever is
// available (1, 2 or 3) when enabled.
export function LatestBlogsStrip() {
  const [blogs, setBlogs] = useState<Blog[] | null>(null);

  useEffect(() => {
    if (!BLOGS_ENABLED) return;
    let mounted = true;
    // Fetch up to 5 so wide screens can render 4–5 cards
    api.getLatestBlogs(5).then((b) => {
      if (mounted) setBlogs(b);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!BLOGS_ENABLED) return null;
  if (blogs && blogs.length === 0) return null; // nothing published yet → hide entirely

  return (
    <section className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">From the blog</p>
            <h2 className="mt-3 font-display text-3xl font-medium text-foreground sm:text-4xl">
              Stories, scenarios & guides from the packaging floor.
            </h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent"
          >
            All articles <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-5 sm:mt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {(blogs ?? Array.from({ length: 3 })).map((b, i) =>
            b ? (
              <Link
                key={(b as Blog).id}
                to={`/blog/${(b as Blog).slug}`}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
              >
                <BlogCard blog={b as Blog} />
              </Link>
            ) : (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-2xl border border-border bg-card"
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
