// ----------------------------------------------------------------------------
// Blog data model
// ----------------------------------------------------------------------------
// Five template types are supported. Each one renders a different field-set on
// the public detail page and surfaces a different form in the admin editor.
// The shape here is the single source of truth — keep BACKEND.md in sync.

export type BlogTemplate =
  | "educative" // explainer: what it is, why it matters, key points
  | "explanatory" // problem → mechanism → takeaway (technical-light)
  | "scenario" // "imagine you run a juice bar in Westlands…"
  | "storyline" // first-person Nairobi narrative
  | "announcement"; // short news / launch / offer

export type BlogStatus = "draft" | "published";

export interface BlogImage {
  url: string;
  alt: string;
  caption?: string;
}

// Template-specific body shapes -----------------------------------------------

export interface EducativeBody {
  intro: string;
  keyPoints: { heading: string; body: string }[];
  conclusion: string;
}

export interface ExplanatoryBody {
  problem: string;
  mechanism: string; // how / why it works
  takeaway: string;
}

export interface ScenarioBody {
  setup: string; // "You run a small bakery in Kilimani…"
  challenge: string; // the packaging problem they hit
  resolution: string; // what they did, what to learn
  callout?: string; // optional pull quote / tip
}

export interface StorylineBody {
  hook: string; // first paragraph in narrative voice
  chapters: { title: string; body: string }[];
  closing: string;
}

export interface AnnouncementBody {
  headline: string; // short bolded line
  body: string; // 1–3 short paragraphs
  ctaLabel?: string;
  ctaHref?: string;
}

export type BlogBody =
  | { template: "educative"; data: EducativeBody }
  | { template: "explanatory"; data: ExplanatoryBody }
  | { template: "scenario"; data: ScenarioBody }
  | { template: "storyline"; data: StorylineBody }
  | { template: "announcement"; data: AnnouncementBody };

// ----------------------------------------------------------------------------

export interface Blog {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  seoTitle?: string;
  seoDescription?: string;
  template: BlogTemplate;
  status: BlogStatus;
  coverImage: BlogImage;
  secondaryImage?: BlogImage;
  body: BlogBody;
  author: string;
  tags: string[];
  readingTimeMin: number;
  publishedAt: string | null; // ISO string, null while draft
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Pretty labels for templates (used in admin + public chips)
export const TEMPLATE_META: Record<BlogTemplate, { label: string; blurb: string }> = {
  educative: {
    label: "Educative",
    blurb: "Explains a packaging concept in plain language.",
  },
  explanatory: {
    label: "Explanatory",
    blurb: "Breaks down the why & how behind a packaging choice.",
  },
  scenario: {
    label: "Scenario",
    blurb: "A realistic Nairobi-business situation with a takeaway.",
  },
  storyline: {
    label: "Storyline",
    blurb: "A short narrative — believable Nairobi voices and places.",
  },
  announcement: {
    label: "Announcement",
    blurb: "News, launches and updates from the Moments team.",
  },
};

// ----------------------------------------------------------------------------
// Seed blogs (mock — replace with backend feed later)
// ----------------------------------------------------------------------------

import bagsImg from "@/assets/cat-bags.jpg";
import cupsImg from "@/assets/cat-cups.jpg";
import boxesImg from "@/assets/cat-boxes.jpg";
import mailersImg from "@/assets/cat-mailers.jpg";

const now = new Date().toISOString();

export const seedBlogs: Blog[] = [
  {
    id: "b1",
    slug: "kraft-vs-coated-which-bag-fits-your-shop",
    title: "Kraft vs Coated: Which Paper Bag Actually Fits Your Shop?",
    excerpt:
      "A no-jargon comparison of the two paper bag families most Nairobi shops choose between — and when each one wins.",
    template: "educative",
    status: "published",
    coverImage: {
      url: bagsImg,
      alt: "Stack of branded kraft paper bags",
    },
    body: {
      template: "educative",
      data: {
        intro:
          "Walk into any boutique on Kimathi Street and you'll see two kinds of bags at the till: rough natural-brown kraft, or smooth printed coated paper. The choice isn't only aesthetic — it changes cost, durability and how your brand is perceived.",
        keyPoints: [
          {
            heading: "Kraft is your workhorse",
            body: "Higher tear strength gram-for-gram, more eco-friendly perception, lower print cost. Best for grocers, takeaways, salons.",
          },
          {
            heading: "Coated paper is your showpiece",
            body: "Crisper colour reproduction and a tactile premium feel. Best for fashion, gifting and corporate hampers.",
          },
          {
            heading: "Weight matters more than finish",
            body: "A 120gsm kraft bag will outlast a 90gsm coated one nearly every time. Spec the weight first, finish second.",
          },
        ],
        conclusion:
          "If you're unsure, start with kraft for daily orders and reserve coated for hampers and gift sets. You can always upgrade once your reorder rhythm is set.",
      },
    },
    author: "Moments Packaging Director",
    tags: ["bags", "kraft", "buyer-guide"],
    readingTimeMin: 4,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "b2",
    slug: "why-double-wall-cups-stop-burning-fingers",
    title: "Why Double-Wall Cups Stop Burning Your Customers' Fingers",
    excerpt:
      "A quick walkthrough of the air-gap physics that makes a double-wall cup feel cool to the touch even when full of espresso.",
    template: "explanatory",
    status: "published",
    coverImage: {
      url: cupsImg,
      alt: "Double-wall paper coffee cups on a counter",
    },
    body: {
      template: "explanatory",
      data: {
        problem:
          "Single-wall cups conduct heat directly to the customer's hand. By the time they've walked five steps from the counter the cup is already too hot to hold without a sleeve.",
        mechanism:
          "A double-wall cup adds a second paper layer with a sealed air pocket between the walls. Air is a poor conductor — so the outer layer stays close to room temperature even when the inner layer is at 85°C.",
        takeaway:
          "If your café serves drinks above 70°C, double-wall pays for itself in fewer dropped cups, no extra sleeves to stock, and a more premium feel in the customer's hand.",
      },
    },
    author: "Moments Packaging Director",
    tags: ["cups", "coffee", "explainer"],
    readingTimeMin: 3,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "b3",
    slug: "the-westlands-juice-bar-that-doubled-orders",
    title: "The Westlands Juice Bar That Doubled Orders With One Packaging Switch",
    excerpt:
      "A made-up-but-believable look at how upgrading from clear plastic to branded kraft sleeves changed Aisha's reorder rate overnight.",
    template: "scenario",
    status: "published",
    coverImage: {
      url: boxesImg,
      alt: "Branded paper sleeves around takeaway bottles",
    },
    body: {
      template: "scenario",
      data: {
        setup:
          "Aisha runs a small cold-press juice bar tucked behind Sarit Centre. She has six SKUs, three staff, and a queue of corporate clients who order 20–30 bottles every Friday for the office.",
        challenge:
          "Her bottles went out in plain clear plastic — so the moment they reached the office fridge, nobody could tell whose juice was whose. Customers were calling Monday mornings asking which flavour was which, and reorders were stalling.",
        resolution:
          "She switched to printed kraft sleeves with the flavour name in big type on the front and her logo on the side. Reorders jumped because the bottles became their own marketing inside the office fridge. Total cost added per bottle: KES 4.",
        callout:
          "Packaging isn't a cost line — it's a silent salesperson sitting in someone's fridge or desk for the next three days.",
      },
    },
    author: "Moments Packaging Director",
    tags: ["scenario", "juice-bar", "branding"],
    readingTimeMin: 5,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "b4",
    slug: "new-eco-mailer-range-now-shipping",
    title: "Our New Eco Mailer Range Is Now Shipping",
    excerpt:
      "Three new mailer sizes in 100% recycled kraft, MOQ from 200 units. Available for online stores and small e-commerce sellers across Kenya.",
    template: "announcement",
    status: "published",
    coverImage: {
      url: mailersImg,
      alt: "Branded eco-friendly kraft mailers",
    },
    body: {
      template: "announcement",
      data: {
        headline: "Three new mailer sizes. 100% recycled kraft. MOQ 200.",
        body: "We've added Small (A5), Medium (A4) and Large (A3) eco mailers to the catalogue, all printed with water-based inks. Delivered countrywide within 3 business days. Built specifically for Kenyan online sellers shipping nationally.",
        ctaLabel: "See the mailer range",
        ctaHref: "/products?category=mailers",
      },
    },
    author: "Moments Packaging Director",
    tags: ["news", "mailers", "launch"],
    readingTimeMin: 2,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
];
