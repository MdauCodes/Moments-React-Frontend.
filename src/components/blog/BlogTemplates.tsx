import type { Blog, BlogBody, BlogCta } from "@/data/blogs";

// Single-source-of-truth renderer. Picks the right template at runtime so
// every public detail page stays consistent with the admin form fields.

export function BlogBodyRenderer({ body }: { body: BlogBody }) {
  switch (body.template) {
    case "educative":
      return <EducativeView data={body.data} />;
    case "explanatory":
      return <ExplanatoryView data={body.data} />;
    case "scenario":
      return <ScenarioView data={body.data} />;
    case "storyline":
      return <StorylineView data={body.data} />;
    case "announcement":
      return <AnnouncementView data={body.data} />;
  }
}

function EducativeView({ data }: { data: Extract<BlogBody, { template: "educative" }>["data"] }) {
  return (
    <div className="space-y-8">
      <p className="text-lg leading-relaxed text-foreground/85">{data.intro}</p>
      <ol className="space-y-6">
        {data.keyPoints.map((kp, i) => (
          <li key={i} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-lg text-foreground">{kp.heading}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{kp.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-l-2 border-accent pl-4 text-base italic text-foreground/80">
        {data.conclusion}
      </p>
      <BodyCta cta={data.cta} />
    </div>
  );
}

function ExplanatoryView({ data }: { data: Extract<BlogBody, { template: "explanatory" }>["data"] }) {
  return (
    <div className="space-y-7">
      <Section label="The problem" body={data.problem} />
      <Section label="How it works" body={data.mechanism} />
      <Section label="The takeaway" body={data.takeaway} accent />
      <BodyCta cta={data.cta} />
    </div>
  );
}

function ScenarioView({ data }: { data: Extract<BlogBody, { template: "scenario" }>["data"] }) {
  return (
    <div className="space-y-6">
      <p className="text-lg leading-relaxed text-foreground/85">{data.setup}</p>
      <p className="leading-relaxed text-foreground/80">{data.challenge}</p>
      <p className="leading-relaxed text-foreground/80">{data.resolution}</p>
      {data.callout && (
        <blockquote className="rounded-2xl border-l-4 border-accent bg-accent/5 p-5 text-base italic text-foreground sm:text-lg">
          “{data.callout}”
        </blockquote>
      )}
      <BodyCta cta={data.cta} />
    </div>
  );
}

// Shared in-article CTA button — used by the educative / explanatory / scenario templates.
// Internal links use react-router semantics via a plain <a>; the blog pages are inside
// SiteLayout so a full navigation is acceptable and keeps this component router-agnostic.
function BodyCta({ cta }: { cta?: BlogCta }) {
  if (!cta?.label || !cta?.href) return null;
  return (
    <div className="pt-2">
      <a
        href={cta.href}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        {cta.label} →
      </a>
    </div>
  );
}

function StorylineView({ data }: { data: Extract<BlogBody, { template: "storyline" }>["data"] }) {
  return (
    <div className="space-y-8">
      <p className="font-display text-xl leading-relaxed text-foreground first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:font-medium first-letter:leading-none first-letter:text-accent">
        {data.hook}
      </p>
      {data.chapters.map((c, i) => (
        <div key={i} className="space-y-3">
          <h3 className="font-display text-2xl text-foreground">{c.title}</h3>
          <p className="leading-relaxed text-foreground/80">{c.body}</p>
        </div>
      ))}
      <p className="border-t border-border pt-6 text-base italic text-muted-foreground">
        {data.closing}
      </p>
    </div>
  );
}

function AnnouncementView({ data }: { data: Extract<BlogBody, { template: "announcement" }>["data"] }) {
  return (
    <div className="space-y-6">
      <p className="font-display text-2xl font-medium text-foreground sm:text-3xl">
        {data.headline}
      </p>
      <p className="text-base leading-relaxed text-foreground/80">{data.body}</p>
      {data.ctaLabel && data.ctaHref && (
        <a
          href={data.ctaHref}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {data.ctaLabel} →
        </a>
      )}
    </div>
  );
}

function Section({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:p-6" : ""}>
      <p className={`text-xs uppercase tracking-[0.2em] ${accent ? "text-accent" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="mt-2 text-base leading-relaxed text-foreground/85">{body}</p>
    </div>
  );
}

// Compact card used in lists & the homepage strip.
export function BlogCard({ blog }: { blog: Blog }) {
  const date = blog.publishedAt
    ? new Date(blog.publishedAt).toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="aspect-[16/10] overflow-hidden bg-secondary">
        {blog.coverImage.url ? (
          <img
            src={blog.coverImage.url}
            alt={blog.coverImage.alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary to-accent/10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {blog.template}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
            {blog.template}
          </span>
          <span>{blog.readingTimeMin} min read</span>
        </div>
        <h3 className="mt-3 font-display text-lg leading-snug text-foreground">
          {blog.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{blog.excerpt}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span className="truncate">By {blog.author}</span>
          {date && <span className="flex-shrink-0">{date}</span>}
        </div>
        <span className="mt-3 text-sm font-medium text-accent">Read story →</span>
      </div>
    </article>
  );
}
