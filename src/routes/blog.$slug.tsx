import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { BlogBodyRenderer, BlogCard } from "@/components/blog/BlogTemplates";
import { api } from "@/services/api";
import { TEMPLATE_META } from "@/data/blogs";
import type { Blog, BlogTemplate } from "@/data/blogs";
import { BLOGS_ENABLED } from "@/config/features";
import { ArrowLeft } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [related, setRelated] = useState<Blog[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!BLOGS_ENABLED) { navigate("/blog", { replace: true }); return; }
    if (!slug) return;
    api.getBlogBySlug(slug).then((b) => {
      if (!b || b.status !== "published") { navigate("/blog", { replace: true }); return; }
      setBlog(b);
      setLoading(false);
      api.getRelatedBlogs(b.slug, 2).then(setRelated).catch(() => setRelated([]));
    });
  }, [slug, navigate]);

  // Per-page SEO — previously every blog post inherited the homepage's title/description/OG
  // tags. blog.seoTitle/seoDescription already exist as admin-editable fields (the CMS side of
  // this was built), but nothing on the frontend ever actually applied them — this is that
  // missing wiring. BlogPosting schema is the shape Google's rich results (and AI assistants
  // summarizing an article) both parse for author/publish date.
  useSeo({
    title: blog ? `${blog.seoTitle || blog.title} — Moments Packaging Kenya` : "Loading… — Moments Packaging Kenya",
    description: blog ? (blog.seoDescription || blog.excerpt) : "Loading article…",
    path: `/blog/${slug ?? ""}`,
    image: blog?.coverImage?.url || undefined,
    jsonLd: blog
      ? {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: blog.seoTitle || blog.title,
          description: blog.seoDescription || blog.excerpt,
          image: blog.coverImage?.url || undefined,
          author: { "@type": "Organization", name: blog.author || "Moments Packaging Kenya" },
          datePublished: blog.publishedAt ?? undefined,
          dateModified: blog.updatedAt ?? undefined,
          mainEntityOfPage: `https://momentspackaging.com/blog/${slug ?? ""}`,
        }
      : undefined,
  });

  if (loading || !blog) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl animate-pulse px-5 py-16 lg:px-8">
          <div className="h-4 w-24 rounded bg-secondary" />
          <div className="mt-8 h-10 w-3/4 rounded bg-secondary" />
          <div className="mt-4 h-4 w-1/2 rounded bg-secondary" />
          <div className="mt-8 aspect-[16/9] rounded-3xl bg-secondary" />
        </div>
      </SiteLayout>
    );
  }

  const meta = TEMPLATE_META[blog.template as BlogTemplate];
  const date = blog.publishedAt
    ? new Date(blog.publishedAt).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <SiteLayout>
      <article>
        <div className="mx-auto max-w-3xl px-5 pt-8 lg:px-8">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-accent">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to blog
          </Link>
        </div>

        <header className="mx-auto max-w-3xl px-5 pt-6 pb-8 lg:px-8">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-accent">{meta.label}</span>
            <span>{date}</span>
            <span>· {blog.readingTimeMin} min read</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-medium leading-[1.15] text-foreground sm:text-4xl lg:text-5xl">{blog.title}</h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">{blog.excerpt}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">By {blog.author}</p>
        </header>

        {blog.coverImage.url && (
          <div className="mx-auto max-w-4xl px-5 lg:px-8">
            <div className="overflow-hidden rounded-3xl bg-secondary">
              <img src={blog.coverImage.url} alt={blog.coverImage.alt} className="aspect-[16/9] w-full object-cover" />
            </div>
            {blog.coverImage.caption && (
              <p className="mt-2 text-center text-xs italic text-muted-foreground">{blog.coverImage.caption}</p>
            )}
          </div>
        )}

        <div className="mx-auto max-w-3xl px-5 py-10 lg:px-8 lg:py-14">
          <BlogBodyRenderer body={blog.body} />
          {blog.secondaryImage && (
            <figure className="my-10 overflow-hidden rounded-2xl bg-secondary">
              <img src={blog.secondaryImage.url} alt={blog.secondaryImage.alt} className="aspect-[16/9] w-full object-cover" />
              {blog.secondaryImage.caption && (
                <figcaption className="px-4 py-2 text-center text-xs italic text-muted-foreground">{blog.secondaryImage.caption}</figcaption>
              )}
            </figure>
          )}
          {blog.tags.length > 0 && (
            <div className="mt-12 flex flex-wrap gap-2 border-t border-border pt-6">
              {blog.tags.map((t: string) => (
                <span key={t} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">#{t}</span>
              ))}
            </div>
          )}
        </div>

        {related && related.length > 0 && (
          <aside className="border-t border-border bg-secondary/40">
            <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-20">
              <p className="text-xs uppercase tracking-[0.25em] text-accent">Keep reading</p>
              <h2 className="mt-3 font-display text-2xl font-medium text-foreground sm:text-3xl">Suggested next read</h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6">
                {related.map((r) => (
                  <Link key={r.id} to={`/blog/${r.slug}`} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <BlogCard blog={r} />
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        )}
      </article>
    </SiteLayout>
  );
}
