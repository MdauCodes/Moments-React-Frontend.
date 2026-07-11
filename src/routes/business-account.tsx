import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { Briefcase, TicketPercent, TrendingUp, ShieldCheck } from "lucide-react";

const BENEFITS = [
  {
    Icon: TicketPercent,
    title: "A welcome discount code",
    desc: "Opening an account earns you a one-time code for a discount on your first order.",
  },
  {
    Icon: TrendingUp,
    title: "A recognized purchase history",
    desc: "Every order you place builds a track record tied to your business, not just your name.",
  },
  {
    Icon: ShieldCheck,
    title: "First in line for trade credit",
    desc: "When our trade credit accounts launch, having an active business account is the starting point.",
  },
];

function BusinessAccountInfoPage() {
  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:py-20 lg:px-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
            <Briefcase className="h-6 w-6" />
          </span>
          <p className="mt-4 text-xs uppercase tracking-widest text-accent">For businesses</p>
          <h1 className="mt-3 font-display text-3xl font-medium text-foreground sm:text-4xl">
            Open a Business Account
          </h1>
          <p className="mt-4 text-muted-foreground">
            Free, self-service, and open to any business ordering from Moments Packaging — no approval
            needed. It's the first step toward trade credit accounts, coming soon.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card p-5">
              <b.Icon className="h-4 w-4 text-accent" />
              <h3 className="mt-3 font-display text-base font-semibold text-foreground">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
          <h2 className="font-display text-xl text-foreground">Ready to open yours?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Takes about a minute — business name, address and a contact person.
          </p>
          <div className="mt-5">
            <Link
              to="/account/business"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Create your Business Account
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            You'll need an account to continue — we'll get you signed in first if you haven't already.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

export default BusinessAccountInfoPage;
