export interface Point {
  x: number;
  y: number;
}

export interface Snake {
  id: string; // Socket ID or simple UUID
  userId?: string; // Stored user account ID if authenticated
  name: string;
  skin: string;
  body: Point[];
  angle: number;
  speed: number;
  score: number;
  isBoosting: boolean;
  length: number;
  colorList: string[]; // Colors for drawing segment patterns
  isBot?: boolean;
}

export interface Food {
  id: number;
  x: number;
  y: number;
  color: string;
  value: number; // Growth value (and score value)
  isBonus?: boolean; // Shiny large food when snakes die
}

export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
}

export interface LiveLeaderboardItem {
  id: string;
  name: string;
  score: number;
  isCurrentUser: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  targetType: 'score' | 'kills' | 'games' | 'coins' | 'length';
  targetValue: number;
  rewardCoins: number;
}

export interface UserStats {
  uid: string;
  nickname: string;
  longestLength: number;
  highScore: number;
  totalKills: number;
  totalGames: number;
  coins: number;
  selectedSkin: string;
  unlockedSkins: string[];
  unlockedAchievements: string[];
  updatedAt: string;
}

export interface SkinStyle {
  id: string;
  name: string;
  colors: string[];
  cost: number;
  unlockRequirement?: string;
}

export const SKINS: SkinStyle[] = [
  { id: 'classic_red', name: 'Ruby Red', colors: ['#ef4444', '#dc2626', '#b91c1c'], cost: 0 },
  { id: 'classic_blue', name: 'Sapphire Blue', colors: ['#3b82f6', '#2563eb', '#1d4ed8'], cost: 0 },
  { id: 'classic_green', name: 'Emerald Green', colors: ['#10b981', '#059669', '#047857'], cost: 0 },
  { id: 'neon_tron', name: 'Tron Cyber', colors: ['#06b6d4', '#000000', '#06b6d4', '#10b981'], cost: 50 },
  { id: 'golden_dragon', name: 'Golden Dragon', colors: ['#fbbf24', '#f59e0b', '#d97706', '#fbbf24'], cost: 100 },
  { id: 'tiger_stripes', name: 'Tiger Stripe', colors: ['#f97316', '#000000', '#f97316', '#7c2d12'], cost: 150 },
  { id: 'stars_stripes', name: 'Stars & Stripes', colors: ['#3b82f6', '#ffffff', '#ef4444', '#ffffff'], cost: 200 },
  { id: 'rainbow', name: 'Rainbow Joy', colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'], cost: 300 },
  { id: 'nebula', name: 'Nebula Space', colors: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6'], cost: 500, unlockRequirement: 'Reach 10,000 points!' },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_feed', title: 'First Feed', description: 'Collect your first particle', targetType: 'score', targetValue: 50, rewardCoins: 10 },
  { id: 'growing_up', title: 'Growing Up', description: 'Reach 500 points in a single run', targetType: 'score', targetValue: 500, rewardCoins: 25 },
  { id: 'giant_serpent', title: 'Giant Serpent', description: 'Reach 2,500 points in a single run', targetType: 'score', targetValue: 2500, rewardCoins: 100 },
  { id: 'slay_master', title: 'Snake Slayer', description: 'Eliminate 5 opposing snakes', targetType: 'kills', targetValue: 5, rewardCoins: 50 },
  { id: 'apex_predator', title: 'Apex Predator', description: 'Eliminate 15 opposing snakes', targetType: 'kills', targetValue: 15, rewardCoins: 150 },
  { id: 'seasoned_veteran', title: 'Seasoned Veteran', description: 'Play 20 games in total', targetType: 'games', targetValue: 20, rewardCoins: 100 },
  { id: 'treasury', title: 'Snake Hoarder', description: 'Accumulate 1,000 coins', targetType: 'coins', targetValue: 1000, rewardCoins: 200 },
];
