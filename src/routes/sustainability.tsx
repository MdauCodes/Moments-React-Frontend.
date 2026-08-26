import { Leaf, Users, ShieldCheck, Recycle } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import esgPoster1 from "@/assets/company-profile/esg-poster-1.jpg";
import { LogoLeafIcon } from "@/components/icons/LogoLeafIcon";
import logoUrl from "@/assets/moments_logo_without_background.png";

const FOREST = "#0d3320";
const FOREST_DEEP = "#08231a";
const GOLD = "#c9a44c";
const GOLD_SOFT = "#e8c878";

function SustainabilityPage() {
  return (
    <SiteLayout>
      {/* ─── SUSTAINABILITY — ESG policy + single poster ─── */}
      <section className="relative" style={{ background: FOREST_DEEP }}>
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-14 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              ESG &amp; Sustainability Policy
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium text-white sm:text-5xl lg:text-6xl">
              Packaging with Purpose.
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-base italic text-white/88">Growing with Responsibility.</p>
            <div className="mx-auto mt-4 flex w-fit items-center gap-3">
              <span className="block h-px w-12" style={{ background: GOLD }} />
              <Recycle className="h-4 w-4" style={{ color: GOLD }} />
              <span className="block h-px w-12" style={{ background: GOLD }} />
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-4xl space-y-4 text-[15px] leading-relaxed text-white/85">
            <p>
              <img
                src={logoUrl}
                alt="Moments Packaging Ltd"
                className="mr-1.5 inline-block align-text-bottom"
                style={{ height: "1.9em", width: "auto" }}
              />{" "}
              treats sustainability as more than a business objective — it is a core value that
              shapes the way we design, source and deliver packaging solutions. We are committed to creating products
              that support our customers while contributing to a healthier planet and a more sustainable future.
            </p>
            <p>
              We actively promote environmentally responsible alternatives by expanding our range of Kraft packaging
              solutions, which are designed with sustainability in mind. Many of our Kraft products are eco-friendly
              (using renewable paper-based materials), biodegradable, compostable, and recyclable — contributing to a
              circular lifecycle and reducing demand for virgin materials. By encouraging the adoption of Kraft
              packaging and other sustainable options, we help our customers reduce their environmental footprint
              without compromising on quality or functionality.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                Icon: Leaf,
                title: "Environmental Stewardship",
                body: "Reducing waste, promoting recyclable and responsibly sourced materials, improving resource efficiency and supporting initiatives that conserve natural resources.",
              },
              {
                Icon: Users,
                title: "Social Responsibility",
                body: "A safe, inclusive workplace. Long-term partnerships built on trust. Reliable products, exceptional service and support for local businesses and communities.",
              },
              {
                Icon: ShieldCheck,
                title: "Ethical Governance",
                body: "Transparency, accountability and integrity in every decision — complying with all applicable laws and continuously improving our ESG performance.",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border p-5"
                style={{ borderColor: `${GOLD}33`, background: FOREST }}
              >
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{ borderColor: `${GOLD}80`, color: GOLD }}
                >
                  <p.Icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-white">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/85">{p.body}</p>
              </div>
            ))}
          </div>

          <div
            className="mx-auto mt-10 max-w-4xl rounded-2xl border p-6"
            style={{ borderColor: `${GOLD}33`, background: FOREST }}
          >
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white p-1.5 sm:h-20 sm:w-20">
                <LogoLeafIcon size={46} />
              </div>
              <div>
                <p className="text-sm leading-relaxed text-white/88">
                  Every package we supply carries an opportunity to make a positive impact. When you see the{" "}
                  <LogoLeafIcon size={14} className="mr-1 inline-block align-text-bottom" />
                  sprouting leaf
                  and ♻️ recycling symbol in our logo, we invite you to see more than a brand — our commitment to protecting
                  natural resources, embracing sustainable innovation and promoting packaging solutions that support a
                  cleaner, greener future.
                </p>
                <p className="mt-3 font-display text-base italic" style={{ color: GOLD_SOFT }}>
                  Together, we can package responsibly today and preserve tomorrow.
                </p>
              </div>
            </div>
          </div>

          {/* Single ESG poster */}
          <div className="mt-12">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              Our ESG &amp; Sustainability Policy
            </p>
            <a
              href={esgPoster1}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mt-5 block max-w-md overflow-hidden rounded-2xl border bg-white/5 transition-transform hover:-translate-y-1"
              style={{ borderColor: `${GOLD}55` }}
              aria-label="Open ESG &amp; Sustainability Policy poster in a new tab"
            >
              <img
                src={esgPoster1}
                alt="Moments Packaging — ESG &amp; Sustainability Policy poster"
                className="block h-full w-full object-cover"
                loading="lazy"
              />
            </a>
            <p className="mt-3 text-center text-xs text-white/80">Tap the poster to view full size.</p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

export default SustainabilityPage;
