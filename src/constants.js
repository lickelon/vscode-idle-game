const TICK_MS = 100;
const ACTIVE_WINDOW_MS = 10000;
const FEVER_GAIN_PER_SEC = 1;
const MULT_DECAY_PER_SEC = 0.1;
const SOFT_CAP_K = 1.0;
const SOFT_CAP_S = 2.0;
const TIER_GROWTH = 1.5;
const DELIVERED_RATE = 0.05;
const RUNTIME_EXP_FACTOR = 0.001;

const LAYERS = [
  { id: 'typing', name: 'Typing', baseCost: 10, growth: 1.2 },
  { id: 'assembly', name: 'Assembly', baseCost: 1_000, growth: 1.25 },
  { id: 'compiler', name: 'Compiler', baseCost: 1_000_000, growth: 1.3 },
  { id: 'high', name: 'High-Level', baseCost: 1_000_000_000, growth: 1.35 },
  { id: 'runtime', name: 'Runtime/Cloud', baseCost: 1_000_000_000_000, growth: 1.4 }
];

const VIEW_IDS = {
  summary: 'vscode-idle-idleView',
  detail: 'vscode-idle-detailView',
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
  DELIVERED_RATE,
  RUNTIME_EXP_FACTOR,
  LAYERS,
  VIEW_IDS
};
