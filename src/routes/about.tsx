import { Link } from "react-router-dom";

import { SiteLayout } from "@/components/SiteLayout";
import aboutImg from "@/assets/about-team.jpg";
import { ArrowRight } from "lucide-react";



const stats = [
  { v: "500+", l: "Brands packaged" },
  { v: "12", l: "Years in operation" },
  { v: "3 days", l: "Average delivery time" },
  { v: "47", l: "Counties served" },
];

const values = [
  { t: "Craft", b: "Every order is print-checked by hand. No batch leaves our floor without a second pair of eyes." },
  { t: "Speed", b: "We protect your launch dates. Same-day dispatch within Nairobi, up to 3 days countrywide." },
  { t: "Partnership", b: "We don't just sell boxes. We help you brief, design, and roll out packaging that sells." },
];

function AboutPage() {
  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Our story</p>
            <h1 className="mt-3 font-display text-4xl font-medium text-foreground sm:text-5xl md:text-6xl lg:text-7xl text-balance">
              Built in Nairobi for Kenya's most ambitious brands.
            </h1>
            <p className="mt-5 text-base text-muted-foreground sm:mt-6 sm:text-lg">
              Moments Packaging started in 2013 with a single offset press and a stubborn belief that
              local brands deserve packaging as good as anything imported. Today we run a modern
              production floor in Industrial Area, serving restaurants, retailers, and corporates
              from Mombasa to Kisumu.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-3xl border border-border">
            <img src={aboutImg} alt="Moments Packaging production floor" className="h-full w-full object-cover" />
          </div>
          <div>
            <h2 className="font-display text-3xl font-medium text-foreground sm:text-4xl">More than just packaging.</h2>
            <p className="mt-5 text-muted-foreground">
              We see ourselves as a partner in your brand's first impression. From the moment a
              customer touches your bag, opens your box, or holds your cup — we want them to feel
              the care that went in.
            </p>
            <p className="mt-4 text-muted-foreground">
              Our team blends offset and digital print, structural design, and hand finishing. We
              source FSC-certified paper where possible and continue investing in lower-impact
              materials and inks.
            </p>
            <Link to="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Work with us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-secondary/60">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.l}>
                <p className="font-display text-4xl font-medium text-foreground sm:text-5xl">{s.v}</p>
                <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground sm:text-sm">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8 lg:py-28">
        <h2 className="font-display text-3xl font-medium text-foreground sm:text-4xl">What we believe.</h2>
        <div className="mt-10 grid gap-5 sm:gap-6 md:grid-cols-3">
          {values.map((v, i) => (
            <div key={v.t} className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <p className="font-display text-4xl font-medium text-accent sm:text-5xl">0{i + 1}</p>
              <h3 className="mt-5 font-display text-xl text-foreground sm:mt-6 sm:text-2xl">{v.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.b}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}

export default AboutPage;
