const TICK_MS = 100;
const ACTIVE_WINDOW_MS = 10000;
const FEVER_GAIN_PER_SEC = 1;
const MULT_DECAY_PER_SEC = 0.1;
const SOFT_CAP_K = 1.0;
const SOFT_CAP_S = 2.0;
const TIER_GROWTH = 1.5;
const TIER_BASE = 10;
const TIER_STEP = 5;
const TIER_POWER = 1.25;
const PRESTIGE_TIER_BOOST = 0.015;
const DELIVERED_RATE = 0.05;
const RUNTIME_EXP_FACTOR = 0.001;
const TYPING_RUNTIME_POWER = 1.5;
const SACRIFICE_S = 0.35;
const PRESTIGE_BASE_PERCENT = 0.1;
const HARD_CAP = 1.8e308;
const DELIVERED_PRESTIGE_BOOST = 0.08;
const DELIVERED_SACRIFICE_BOOST = 0.3;

const LAYERS = [
  { id: 'typing', name: 'Typing', baseCost: 10, growth: 1.2 },
  { id: 'assembly', name: 'Assembly', baseCost: 1_000, growth: 1.25 },
  { id: 'compiler', name: 'Compiler', baseCost: 1_000_000, growth: 1.3 },
  { id: 'high', name: 'High-Level', baseCost: 1_000_000_000, growth: 1.35 },
  { id: 'runtime', name: 'Runtime/Cloud', baseCost: 1_000_000_000_000, growth: 1.4 },
  { id: 'synthesis', name: 'Program Synthesis', baseCost: 1_000_000_000_000_000, growth: 1.45 }
];

const VIEW_IDS = {
  summary: 'vscode-idle-idleView',
  detail: 'vscode-idle-detailView',
  reset: 'vscode-idle-resetView',
  debug: 'vscode-idle-debugView'
};

module.exports = {
  TICK_MS,
  ACTIVE_WINDOW_MS,
  FEVER_GAIN_PER_SEC,
  MULT_DECAY_PER_SEC,
  SOFT_CAP_K,
  SOFT_CAP_S,
  TIER_GROWTH,
  TIER_BASE,
  TIER_STEP,
  TIER_POWER,
  PRESTIGE_TIER_BOOST,
  DELIVERED_RATE,
  RUNTIME_EXP_FACTOR,
  TYPING_RUNTIME_POWER,
  SACRIFICE_S,
  PRESTIGE_BASE_PERCENT,
  DELIVERED_PRESTIGE_BOOST,
  DELIVERED_SACRIFICE_BOOST,
  HARD_CAP,
  LAYERS,
  VIEW_IDS
};
