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
    title: "Welcome bonus Reward Coupons",
    desc: "Open your account and earn welcome Reward Coupons immediately — redeemable for a discount on any order.",
  },
  {
    Icon: TrendingUp,
    title: "Earn on every order",
    desc: "Reward Coupons accrue on every paid order, plus bonuses for leaving product reviews.",
  },
  {
    Icon: Users,
    title: "Referral rewards",
    desc: "Share your link — you and your friend both earn when they sign up and order.",
  },
];

const GUEST_POINTS = [
  { ok: true, text: "Place and pay for an order without registering" },
  { ok: true, text: "Track your order by reference number" },
  { ok: true, text: "Download your receipt and tax invoice" },
  { ok: false, text: "Reward Coupons on signup or per order" },
  { ok: false, text: "Referral rewards" },
  { ok: false, text: "Saved order history in an account dashboard" },
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
            Which way of shopping fits you?
          </h1>
          <p className="mt-4 text-muted-foreground">
            Three ways to order from Moments Packaging — a Business Account, an Individual Shopper account, or
            shopping as a guest with no account at all. Here's what each one actually gets you.
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
          desc="Free, self-service, and open to any business ordering from Moments Packaging — no approval needed. It's the first step toward trade credit accounts, coming soon."
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
          <p className="mt-3 text-xs text-muted-foreground">Takes about a minute — business name, address and a contact person.</p>
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
            desc="Free, instant, and open to anyone ordering from Moments Packaging for themselves or their own small business."
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
            <p className="mt-3 text-xs text-muted-foreground">Takes about a minute — that's it, you're in.</p>
          </div>
        </div>
      </div>

      {/* ─── Shop as a guest ─── */}
      <div className="mx-auto max-w-4xl px-5 py-14 sm:py-16 lg:px-8">
        <Section
          id="guest"
          eyebrow="No account needed"
          Icon={ShoppingBag}
          title="Shop anonymously, as a guest"
          desc="You don't need an account to buy from us — place an order with just your contact and delivery details, and track it anytime with your order reference. Here's what you get and what you miss out on compared to having an account."
        />
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-6">
          <ul className="space-y-2.5 text-left text-sm">
            {GUEST_POINTS.map((p) => (
              <li key={p.text} className="flex items-start gap-2.5">
                {p.ok ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={p.ok ? "text-foreground" : "text-muted-foreground"}>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 text-center">
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Browse products as a guest
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Prefer the rewards? <Link to="/account/register" className="text-accent hover:underline">Create an account instead</Link>.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

export default AccountOptionsPage;
