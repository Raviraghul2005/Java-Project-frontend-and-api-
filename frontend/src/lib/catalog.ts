import { PresetSubscription } from "@/types";

export const PRESET_SUBSCRIPTIONS: PresetSubscription[] = [
  {
    name: "Claude Pro",
    domain: "claude.ai",
    logo: "/logos/claude.ai.png",
    category: "technology",
    price: 20.0,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "Anthropic's flagship AI assistant with Claude 3.7 Sonnet & thinking mode."
  },
  {
    name: "ChatGPT Plus",
    domain: "openai.com",
    logo: "/logos/openai.com.png",
    category: "technology",
    price: 20.0,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Apple Pay",
    description: "OpenAI GPT-4o, advanced voice mode, Canvas, and DALL-E image generation."
  },
  {
    name: "Figma Professional",
    domain: "figma.com",
    logo: "/logos/figma.com.png",
    category: "technology",
    price: 15.0,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "Collaborative interface design tool with unlimited files and team libraries."
  },
  {
    name: "Netflix Premium",
    domain: "netflix.com",
    logo: "/logos/netflix.com.png",
    category: "entertainment",
    price: 22.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "4K Ultra HD streaming, spatial audio, and multiple screens."
  },
  {
    name: "Spotify Premium",
    domain: "spotify.com",
    logo: "/logos/spotify.com.png",
    category: "entertainment",
    price: 11.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "PayPal",
    description: "Ad-free music streaming, offline playback, and lossless audio."
  },
  {
    name: "GitHub Copilot",
    domain: "github.com",
    logo: "/logos/github.com.png",
    category: "technology",
    price: 10.0,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "AI pair programmer and agentic workspace autocomplete."
  },
  {
    name: "YouTube Premium",
    domain: "youtube.com",
    logo: "/logos/youtube.com.png",
    category: "entertainment",
    price: 13.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Google Pay",
    description: "Ad-free YouTube videos, background play, and YouTube Music."
  },
  {
    name: "Disney+",
    domain: "disneyplus.com",
    logo: "/logos/disneyplus.com.png",
    category: "entertainment",
    price: 13.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "Disney, Pixar, Marvel, Star Wars, and National Geographic movies."
  },
  {
    name: "Amazon Prime Video",
    domain: "primevideo.com",
    logo: "/logos/primevideo.com.png",
    category: "entertainment",
    price: 14.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Amazon Store Card",
    description: "Original movies, Prime shipping benefits, and digital video rentals."
  },
  {
    name: "Notion Plus",
    domain: "notion.so",
    logo: "/logos/notion.so.png",
    category: "technology",
    price: 10.0,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "PayPal",
    description: "Connected workspace for notes, docs, task boards, and AI writing."
  },
  {
    name: "Adobe Creative Cloud",
    domain: "adobe.com",
    logo: "/logos/adobe.com.png",
    category: "technology",
    price: 54.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "Full suite including Photoshop, Illustrator, Premiere Pro, and After Effects."
  },
  {
    name: "1Password",
    domain: "1password.com",
    logo: "/logos/1password.com.png",
    category: "technology",
    price: 2.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Apple Pay",
    description: "Secure password management, 2FA authenticator, and identity vault."
  },
  {
    name: "Slack Pro",
    domain: "slack.com",
    logo: "/logos/slack.com.png",
    category: "technology",
    price: 8.75,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Corporate Card",
    description: "Unlimited message archives, huddles with screen share, and app integrations."
  },
  {
    name: "Discord Nitro",
    domain: "discord.com",
    logo: "/logos/discord.com.png",
    category: "lifestyle",
    price: 9.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "PayPal",
    description: "500MB file uploads, HD screen sharing, custom emojis, and server boosts."
  },
  {
    name: "HBO Max",
    domain: "hbomax.com",
    logo: "/logos/hbomax.com.png",
    category: "entertainment",
    price: 15.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "Prestige HBO originals, Warner Bros movies, and Discovery documentaries."
  },
  {
    name: "Duolingo Super",
    domain: "duolingo.com",
    logo: "/logos/duolingo.com.png",
    category: "lifestyle",
    price: 6.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Google Pay",
    description: "Unlimited hearts, ad-free language learning lessons, and practice hub."
  },
  {
    name: "Medium Member",
    domain: "medium.com",
    logo: "/logos/medium.com.png",
    category: "news",
    price: 5.0,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "Unlimited access to member-only technical essays, insights, and stories."
  },
  {
    name: "LinkedIn Premium",
    domain: "linkedin.com",
    logo: "/logos/linkedin.com.png",
    category: "technology",
    price: 39.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "InMail messaging, profile viewer analytics, and LinkedIn Learning courses."
  },
  {
    name: "Xbox Game Pass Ultimate",
    domain: "xbox.com",
    logo: "/logos/xbox.com.png",
    category: "entertainment",
    price: 19.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Microsoft Account",
    description: "Hundreds of high-quality PC and console games plus EA Play membership."
  },
  {
    name: "Canva Pro",
    domain: "canva.com",
    logo: "/logos/canva.com.png",
    category: "technology",
    price: 12.99,
    currency: "USD",
    frequency: "monthly",
    paymentMethod: "Credit Card",
    description: "Premium visual design templates, background remover, and brand kits."
  }
];

/** Brand keywords -> logo. Matched as whole words so "Password Manager" is not mistaken for 1Password. */
const LOGO_KEYWORDS: [RegExp, string][] = [
  [/\bnetflix\b/, "/logos/netflix.com.png"],
  [/\bspotify\b/, "/logos/spotify.com.png"],
  [/\b(claude|anthropic)\b/, "/logos/claude.ai.png"],
  [/\b(chatgpt|openai)\b/, "/logos/openai.com.png"],
  [/\bgithub\b/, "/logos/github.com.png"],
  [/\byoutube\b/, "/logos/youtube.com.png"],
  [/\bdisney\b/, "/logos/disneyplus.com.png"],
  [/\b(prime|amazon)\b/, "/logos/primevideo.com.png"],
  [/\badobe\b/, "/logos/adobe.com.png"],
  [/\bfigma\b/, "/logos/figma.com.png"],
  [/\bnotion\b/, "/logos/notion.so.png"],
  [/\bdiscord\b/, "/logos/discord.com.png"],
  [/\bxbox\b/, "/logos/xbox.com.png"],
  [/\bslack\b/, "/logos/slack.com.png"],
  [/\bmedium\b/, "/logos/medium.com.png"],
  [/\bduolingo\b/, "/logos/duolingo.com.png"],
  [/\b1password\b/, "/logos/1password.com.png"],
  [/\bcanva\b/, "/logos/canva.com.png"]
];

export function findLogoForSubscription(name: string): string | null {
  const clean = (name || "").toLowerCase().trim();
  if (clean.length < 3) return null;

  // Exact preset name first, then a preset name contained in the (longer) subscription name.
  const exact = PRESET_SUBSCRIPTIONS.find((preset) => preset.name.toLowerCase() === clean);
  if (exact) return exact.logo;
  const contained = PRESET_SUBSCRIPTIONS.find((preset) => clean.includes(preset.name.toLowerCase()));
  if (contained) return contained.logo;

  for (const [pattern, logo] of LOGO_KEYWORDS) {
    if (pattern.test(clean)) return logo;
  }
  return null;
}

export function getSubscriptionInitials(name: string): string {
  if (!name) return "BP";
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return (clean[0] || "B").toUpperCase();
}
