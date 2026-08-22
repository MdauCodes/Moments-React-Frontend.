import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { Briefcase, Gift, TrendingUp, ShieldCheck, Users, ShoppingBag, Check, X } from "lucide-react";

const BUSINESS_BENEFITS = [
  {
    Icon: Gift,
    title: "Welcome bonus + Reward Coupons",
    desc: "Earn a welcome bonus on signup, then Reward Coupons on every order — redeemable for real discounts, plus referral rewards.",
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

const INDIVIDUAL_BENEFITS = [
  {
    Icon: Gift,
    title: "Welcome Bonus Reward Coupons",
    desc: "Open your account and receive 1,000 Reward Coupons (worth KES 100) immediately. Redeem your Reward Coupons for discounts on future orders.",
  },
  {
    Icon: TrendingUp,
    title: "Earn on Every Order",
    desc: "Earn Reward Coupons with every paid order, plus additional bonuses for leaving product reviews.",
  },
  {
    Icon: Users,
    title: "Referral Rewards",
    desc: "Share your referral link with a friend. You and your friend both earn rewards when they sign up and place their first order.",
  },
];

const GUEST_GET = [
  "Place and pay for your order without registering.",
  "Track your order using your order reference number.",
  "Download your receipt and tax invoice.",
];

const GUEST_MISS = [
  "Welcome Reward Coupons and ongoing rewards.",
  "Referral rewards for you and your friends.",
  "Saved order history and access to your account dashboard.",
];

function Section({
  id,
  eyebrow,
  Icon,
  title,
  desc,
}: {
  id: string;
  eyebrow: string;
  Icon: typeof Briefcase;
  title: string;
  desc: string;
}) {
  return (
    <div id={id} className="scroll-mt-20 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-xs uppercase tracking-widest text-accent">{eyebrow}</p>
      <h2 className="mt-3 font-display text-2xl font-medium text-foreground sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{desc}</p>
    </div>
  );
}

function AccountOptionsPage() {
  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:py-20 lg:px-8">
          <h1 className="font-display text-3xl font-medium text-foreground sm:text-4xl">
            Which Way of Shopping Fits You?
          </h1>
          <p className="mt-4 text-muted-foreground">
            Choose the option that works best for you. Moments Packaging offers three ways to shop: a Business
            Account, an Individual Shopper Account, or Guest Checkout with no account required. Here's what each
            option offers and how it can benefit you.
          </p>
        </div>
      </section>

      {/* ─── Business Account ─── */}
      <div className="mx-auto max-w-4xl px-5 py-14 sm:py-16 lg:px-8">
        <Section
          id="business"
          eyebrow="For businesses"
          Icon={Briefcase}
          title="Business Account"
          desc="Free, easy to set up, and available to any business ordering from Moments Packaging. No approval is required to create an account. Business Accounts are also the first step towards accessing trade credit facilities, coming soon."
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {BUSINESS_BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card p-5">
              <b.Icon className="h-4 w-4 text-accent" />
              <h3 className="mt-3 font-display text-base font-semibold text-foreground">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            to="/account/register?type=business"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create your Business Account
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">It takes about a minute to set up — simply provide your business name, address, and contact person's details.</p>
        </div>
      </div>

      {/* ─── Individual Shopper ─── */}
      <div className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-4xl px-5 py-14 sm:py-16 lg:px-8">
          <Section
            id="individual"
            eyebrow="For individuals"
            Icon={Gift}
            title="Individual Shopper Account"
            desc="Free, instant, and open to anyone shopping with Moments Packaging for personal use or their own small business."
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {INDIVIDUAL_BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-5">
                <b.Icon className="h-4 w-4 text-accent" />
                <h3 className="mt-3 font-display text-base font-semibold text-foreground">{b.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/account/register?type=merchant"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Create your Individual Shopper Account
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">It takes about a minute to sign up — and that's it, you're in!</p>
          </div>
        </div>
      </div>

      {/* ─── Shop as a guest ─── */}
      <div className="mx-auto max-w-4xl px-5 py-14 sm:py-16 lg:px-8">
        <Section
          id="guest"
          eyebrow="No account needed"
          Icon={ShoppingBag}
          title="Shop as a Guest"
          desc="You don't need an account to shop with Moments Packaging. Simply place your order using your contact and delivery details, then track it anytime using your order reference number."
        />
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">What you get</p>
          <ul className="mt-2.5 space-y-2.5 text-left text-sm">
            {GUEST_GET.map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-foreground">{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-foreground">What you miss out on</p>
          <ul className="mt-2.5 space-y-2.5 text-left text-sm">
            {GUEST_MISS.map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 text-center">
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Browse Products as a Guest
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Prefer the rewards and other account benefits? <Link to="/account/register" className="text-accent hover:underline">Create an Account Instead</Link>.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

export default AccountOptionsPage;
