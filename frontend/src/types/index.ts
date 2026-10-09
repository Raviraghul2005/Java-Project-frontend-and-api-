export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export type Category =
  | "sports"
  | "news"
  | "entertainment"
  | "lifestyle"
  | "technology"
  | "finance"
  | "politics"
  | "other";

export type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  frequency: Frequency;
  category: Category;
  paymentMethod: string;
  status: SubscriptionStatus;
  startDate: string;
  renewalDate?: string;
  user?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSubscriptionInput {
  name: string;
  price: number;
  currency?: string;
  frequency: Frequency;
  category: Category;
  paymentMethod: string;
  startDate: string;
  renewalDate?: string;
  status?: SubscriptionStatus;
}

export interface RedundancyGroup {
  category: string;
  title: string;
  serviceNames: string[];
  monthlySpend: number;
  annualSpend: number;
  potentialAnnualSavings: number;
  recommendation: string;
}

export interface VampireProjection {
  subscriptionId: string;
  name: string;
  category: string;
  monthlyCost: number;
  oneYearSpend: number;
  threeYearSpend: number;
  fiveYearSpend: number;
  fiveYearOpportunityCost: number;
  highDrainRisk: boolean;
}

export interface RenewalCollision {
  date: string;
  count: number;
  totalCost: number;
  serviceNames: string[];
  collisionRisk: boolean;
}

export interface CategoryBreakdown {
  category: Category;
  categoryName: string;
  monthlySpend: number;
  percentage: number;
  count: number;
}

export interface AnalyticsData {
  totalMonthlySpend: number;
  totalAnnualSpend: number;
  activeCount: number;
  fatigueIndex: number;
  fatigueLevel: "OPTIMAL" | "MODERATE" | "ELEVATED" | "BURNOUT" | string;
  fatigueColor: string;
  fatigueInterpretation: string;
  redundancyCount: number;
  potentialAnnualSavings: number;
  redundancies: RedundancyGroup[];
  total5YearOpportunityCost: number;
  vampireProjections: VampireProjection[];
  collisionTimeline: RenewalCollision[];
  categoryBreakdowns: CategoryBreakdown[];
}

export interface PresetSubscription {
  name: string;
  domain: string;
  logo: string;
  category: Category;
  price: number;
  currency: string;
  frequency: Frequency;
  paymentMethod: string;
  description: string;
}
