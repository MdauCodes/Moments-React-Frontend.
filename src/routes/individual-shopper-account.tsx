import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { Gift, Sparkles, TrendingUp, Users } from "lucide-react";

const BENEFITS = [
  {
    Icon: Sparkles,
    title: "Welcome bonus points",
    desc: "Open your account and earn welcome points immediately — redeemable for a discount on any order.",
  },
  {
    Icon: TrendingUp,
    title: "Earn on every order",
    desc: "Points accrue on every paid order, plus bonuses for leaving product reviews.",
  },
  {
    Icon: Users,
    title: "Referral rewards",
    desc: "Share your link — you and your friend both earn when they sign up and order.",
  },
];

function IndividualShopperAccountInfoPage() {
  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:py-20 lg:px-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
            <Gift className="h-6 w-6" />
          </span>
          <p className="mt-4 text-xs uppercase tracking-widest text-accent">For individuals</p>
          <h1 className="mt-3 font-display text-3xl font-medium text-foreground sm:text-4xl">
            Open an Individual Shopper Account
          </h1>
          <p className="mt-4 text-muted-foreground">
            Free, self-service, and open to anyone ordering from Moments Packaging — earn points on every
            order and redeem them for real discounts.
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
          <h2 className="font-display text-xl text-foreground">Ready to start earning?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Takes about a minute — just your name, email and phone.
          </p>
          <div className="mt-5">
            <Link
              to="/account/register?type=merchant"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Get your free Individual Shopper Account
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Ordering for a registered business instead?{" "}
            <Link to="/business-account" className="text-accent hover:underline">
              See Business Accounts
            </Link>
            .
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

export default IndividualShopperAccountInfoPage;
