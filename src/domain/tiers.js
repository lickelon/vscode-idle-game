const Decimal = require('../vendor/break_infinity.min.js');
const { TIER_BASE, TIER_STEP, TIER_GROWTH } = require('../constants');

function getTierThreshold(tier) {
  if (tier <= 1) {
    return 0;
  }
  return ((tier - 1) / 2) * (2 * TIER_BASE + (tier - 2) * TIER_STEP);
}

function getNextTierRemaining(totalLevel, tier) {
  const nextThreshold = getTierThreshold(tier + 1);
  const remaining = Math.max(0, nextThreshold - totalLevel.toNumber());
  return remaining;
}

function getTier(level) {
  const levelNum = level.toNumber();
  if (!Number.isFinite(levelNum)) {
    return 1;
  }
  let tier = 1;
  while (getTierThreshold(tier + 1) <= levelNum) {
    tier += 1;
  }
  return tier;
}

function calcTierCost(level) {
  const tier = getTier(level);
  return new Decimal(TIER_GROWTH).pow(tier - 1);
}

module.exports = {
  getTierThreshold,
  getNextTierRemaining,
  getTier,
  calcTierCost
};
