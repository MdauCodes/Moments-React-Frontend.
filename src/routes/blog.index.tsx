import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { BlogCard } from "@/components/blog/BlogTemplates";
import { api } from "@/services/api";
import type { Blog, BlogTemplate } from "@/data/blogs";
import { TEMPLATE_META } from "@/data/blogs";
import { BLOGS_ENABLED } from "@/config/features";



const FILTERS: { id: "all" | BlogTemplate; label: string }[] = [
  { id: "all", label: "All" },
  { id: "educative", label: "Educative" },
  { id: "explanatory", label: "Explanatory" },
  { id: "scenario", label: "Scenarios" },
  { id: "storyline", label: "Storylines" },
  { id: "announcement", label: "News" },
];

function BlogIndexPage() {
  const [blogs, setBlogs] = useState<Blog[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  useEffect(() => {
    let mounted = true;
    api.getBlogs({ status: "published" }).then((b) => {
      if (mounted) setBlogs(b);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = (blogs ?? []).filter((b) => filter === "all" || b.template === filter);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-5 pt-10 pb-6 sm:pt-14 lg:px-8">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">Insights</p>
        <h1 className="mt-3 font-display text-4xl font-medium text-foreground sm:text-5xl lg:text-6xl">
          The Moments blog
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Educative explainers, real Nairobi scenarios and short stories on how packaging
          quietly shapes how a brand is remembered.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                filter === f.id
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-background text-foreground/75 hover:bg-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
        {blogs === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No articles in <strong className="text-foreground">{TEMPLATE_META[filter as BlogTemplate]?.label ?? filter}</strong> yet.
              Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => (
              <Link
                key={b.id}
                to={`/blog/${b.slug}/`}
                className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <BlogCard blog={b} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

export default BlogIndexPage;
