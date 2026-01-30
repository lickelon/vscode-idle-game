const Decimal = require('../vendor/break_infinity.min.js');
const { LAYERS, TIER_GROWTH } = require('../constants');
const { getTier, getTierThreshold } = require('./tiers');

const LAYER_INDEX = Object.fromEntries(LAYERS.map((layer, index) => [layer.id, index]));

function calcLayerCost(state, layerId) {
  const layer = LAYERS[LAYER_INDEX[layerId]];
  const level = state.layers[layerId].level;
  const tier = getTier(level);
  const base = new Decimal(layer.baseCost);
  const growth = new Decimal(layer.growth);
  const tierGrowth = new Decimal(TIER_GROWTH);

  const cost = base.mul(growth.pow(level));
  const tierCost = tierGrowth.pow(tier - 1);
  return cost.mul(tierCost);
}

function sumGeometricSeries(first, growth, amount) {
  if (amount <= 0) {
    return new Decimal(0);
  }
  if (growth.eq(1)) {
    return first.mul(amount);
  }
  return first.mul(growth.pow(amount).sub(1)).div(growth.sub(1));
}

function purchaseLayer(state, layerId) {
  const cost = calcLayerCost(state, layerId);
  if (state.bits.lt(cost)) {
    return false;
  }

  state.bits = state.bits.sub(cost);
  state.layers[layerId].level = state.layers[layerId].level.add(1);
  return true;
}

function purchaseMaxLayer(state, layerId) {
  const layer = LAYERS[LAYER_INDEX[layerId]];
  const growth = new Decimal(layer.growth);
  const base = new Decimal(layer.baseCost);
  let level = state.layers[layerId].level;
  let remaining = state.bits;
  let purchased = 0;

  while (true) {
    const tier = getTier(level);
    const tierCost = new Decimal(TIER_GROWTH).pow(tier - 1);
    const startCost = base.mul(growth.pow(level)).mul(tierCost);
    const nextTierLevel = getTierThreshold(tier + 1);
    const maxLevelsThisTier = nextTierLevel - level.toNumber();

    if (maxLevelsThisTier <= 0) {
      break;
    }

    const rhs = remaining.mul(growth.sub(1)).div(startCost).add(1);
    if (rhs.lte(1)) {
      break;
    }

    const maxAffordable = Math.floor(rhs.log(layer.growth));
    const toBuy = Math.min(maxAffordable, maxLevelsThisTier);
    if (toBuy <= 0) {
      break;
    }

    const totalCost = sumGeometricSeries(startCost, growth, toBuy);
    if (remaining.lt(totalCost)) {
      break;
    }

    remaining = remaining.sub(totalCost);
    level = level.add(toBuy);
    purchased += toBuy;
  }

  if (purchased <= 0) {
    return false;
  }

  state.bits = remaining;
  state.layers[layerId].level = level;
  return true;
}

function purchaseAllMax(state) {
  let purchased = false;
  for (const layer of LAYERS) {
    if (purchaseMaxLayer(state, layer.id)) {
      purchased = true;
    }
  }
  return purchased;
}

module.exports = {
  calcLayerCost,
  purchaseLayer,
  purchaseMaxLayer,
  purchaseAllMax
};
