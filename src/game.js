const Decimal = require('./vendor/break_infinity.min.js');
const {
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
  SACRIFICE_SOFTCAP_START,
  SACRIFICE_SOFTCAP_DIVISOR,
  PRESTIGE_BASE_PERCENT,
  HARD_CAP,
  DELIVERED_PRESTIGE_BOOST,
  DELIVERED_SACRIFICE_BOOST,
  LAYERS
} = require('./constants');

const LAYER_INDEX = Object.fromEntries(LAYERS.map((layer, index) => [layer.id, index]));

function toDecimal(value) {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value || 0);
}

function clampBits(value) {
  const cap = new Decimal(HARD_CAP);
  return value.gt(cap) ? cap : value;
}

function createLayerState(savedLayer) {
  return {
    level: toDecimal(savedLayer?.level || 0),
    delivered: toDecimal(savedLayer?.delivered || 0),
    baseLevel: toDecimal(savedLayer?.baseLevel || 0)
  };
}

function createGameState(saved) {
  const layers = {};
  for (const layer of LAYERS) {
    layers[layer.id] = createLayerState(saved?.layers?.[layer.id]);
  }

  const bits = clampBits(toDecimal(saved?.bits || 0));
  const autoBuyEnabled = {};
  for (const layer of LAYERS) {
    autoBuyEnabled[layer.id] = !!saved?.autoBuyEnabled?.[layer.id];
  }
  const state = {
    bits,
    sacrificePoints: toDecimal(saved?.sacrificePoints || 0),
    sacrificeMult: toDecimal(saved?.sacrificeMult || 1),
    fever: saved?.fever || 0,
    lastTick: saved?.lastTick || Date.now(),
    lastInput: saved?.lastInput || 0,
    autoBuyEnabled,
    layers
  };

  state.sacrificeMult = applySacrificeSoftCap(
    calcSacrificeRewardFromPoints(state.sacrificePoints)
  ).value;

  const allZero = LAYERS.every((layer) => state.layers[layer.id].level.eq(0));
  if (bits.eq(0) && allZero) {
    state.bits = new Decimal(10);
  }

  return state;
}

function serializeGameState(state) {
  state.bits = clampBits(state.bits);
  const layers = {};
  for (const layer of LAYERS) {
    const layerState = state.layers[layer.id];
    layers[layer.id] = {
      level: layerState.level.toString(),
      delivered: layerState.delivered.toString(),
      baseLevel: layerState.baseLevel.toString()
    };
  }

  return {
    bits: state.bits.toString(),
    sacrificePoints: state.sacrificePoints.toString(),
    sacrificeMult: state.sacrificeMult.toString(),
    fever: state.fever,
    lastTick: state.lastTick,
    lastInput: state.lastInput,
    autoBuyEnabled: state.autoBuyEnabled,
    layers
  };
}

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

function getTotalLevel(layerState) {
  return layerState.level.add(layerState.baseLevel);
}

function calcMultiplier(fever) {
  const x = Math.log10(1 + fever);
  return 1 + (x * SOFT_CAP_K) / (1 + x / SOFT_CAP_S);
}

function feverFromMultiplier(target) {
  if (target <= 1) {
    return 0;
  }

  let low = 0;
  let high = 1;
  while (calcMultiplier(high) < target && high < 1e9) {
    high *= 2;
  }

  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    if (calcMultiplier(mid) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

function calcLayerEffect(state, layerId, runtimeEffect, runtimeBoost, tierPower) {
  const layerState = state.layers[layerId];
  const totalLevel = getTotalLevel(layerState);
  const tier = getTier(totalLevel);
  const purchased = runtimeBoost && layerId !== 'runtime' && layerId !== 'synthesis'
    ? totalLevel.mul(runtimeBoost)
    : totalLevel;
  const c = purchased.add(layerState.delivered);
  const tierMult = new Decimal(tier).pow(tierPower);
  let e = c.mul(tierMult);

  if (layerId === 'typing') {
    const runtimeMult = new Decimal(runtimeEffect).pow(TYPING_RUNTIME_POWER);
    e = e.mul(runtimeMult);
  }

  return {
    tier,
    c,
    e
  };
}

function calcEffects(state) {
  const effects = {};
  const prestigeBaseTotal = LAYERS.reduce((sum, layer) => {
    return sum.add(state.layers[layer.id].baseLevel);
  }, new Decimal(0));
  const prestigeLog = new Decimal(prestigeBaseTotal.add(1).log10());
  const tierPower = TIER_POWER * (1 + prestigeLog.mul(PRESTIGE_TIER_BOOST).toNumber());
  const runtimeBase = calcLayerEffect(state, 'runtime', 1, null, tierPower).e;
  const runtimeFactor = 1 + RUNTIME_EXP_FACTOR * runtimeBase.toNumber();
  const runtimeBoost = new Decimal(runtimeBase.add(1).log10()).add(1);

  for (const layer of LAYERS) {
    const runtimeEffect = layer.id === 'typing' ? runtimeFactor : 1;
    effects[layer.id] = calcLayerEffect(state, layer.id, runtimeEffect, runtimeBoost, tierPower);
  }

  return effects;
}

function calcBaseBits(state, effects) {
  const one = new Decimal(1);
  return effects.typing.e
    .mul(one.add(effects.assembly.e))
    .mul(one.add(effects.compiler.e))
    .mul(one.add(effects.high.e))
    .mul(one.add(effects.runtime.e))
    .mul(one.add(effects.synthesis.e));
}

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

function calcTierCost(level) {
  const tier = getTier(level);
  return new Decimal(TIER_GROWTH).pow(tier - 1);
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

function applyDelta(state, seconds, active) {
  if (seconds <= 0) {
    return;
  }

  for (const layer of LAYERS) {
    if (state.autoBuyEnabled[layer.id]) {
      purchaseMaxLayer(state, layer.id);
    }
  }

  const multBefore = calcMultiplier(state.fever);
  let multAfter = multBefore;

  if (active) {
    state.fever += FEVER_GAIN_PER_SEC * seconds;
    multAfter = calcMultiplier(state.fever);
  } else if (multBefore > 1) {
    const newMult = Math.max(1, multBefore - MULT_DECAY_PER_SEC * seconds);
    multAfter = newMult;
    state.fever = newMult <= 1 ? 0 : feverFromMultiplier(newMult);
  }

  const effects = calcEffects(state);
  const baseBits = calcBaseBits(state, effects);
  const avgMult = (multBefore + multAfter) / 2;
  const gain = baseBits.mul(state.sacrificeMult).mul(avgMult * seconds);
  state.bits = clampBits(state.bits.add(gain));

  const prestigeBaseTotal = LAYERS.reduce((sum, layer) => {
    return sum.add(state.layers[layer.id].baseLevel);
  }, new Decimal(0));
  const prestigeBoost = new Decimal(1).add(prestigeBaseTotal.mul(DELIVERED_PRESTIGE_BOOST));
  const sacrificeBoost = new Decimal(1).add(state.sacrificeMult.mul(DELIVERED_SACRIFICE_BOOST));
  const deliveredRate = new Decimal(1)
    .add(new Decimal(DELIVERED_RATE).mul(sacrificeBoost))
    .pow(prestigeBoost)
    .sub(1);
  const deliveredSeconds = new Decimal(seconds);

  state.layers.assembly.delivered = state.layers.assembly.delivered.add(
    effects.compiler.e.mul(deliveredRate).mul(deliveredSeconds)
  );
  state.layers.compiler.delivered = state.layers.compiler.delivered.add(
    effects.high.e.mul(deliveredRate).mul(deliveredSeconds)
  );
  state.layers.high.delivered = state.layers.high.delivered.add(
    effects.synthesis.e.mul(deliveredRate).mul(deliveredSeconds)
  );
  state.layers.typing.delivered = state.layers.typing.delivered.add(
    effects.synthesis.e.mul(deliveredRate).mul(deliveredSeconds)
  );
}

function formatDecimal(value) {
  if (!value) {
    return '0';
  }

  if (Number.isNaN(value.m) || Number.isNaN(value.e)) {
    return '0';
  }

  if (value.lt(1000)) {
    return value.toFixed(1);
  }

  const exp = Math.floor(value.log10());
  if (exp < 6) {
    return value.toFixed(0);
  }

  const mantissa = value.div(Decimal.pow(10, exp)).toNumber();
  return `${mantissa.toFixed(2)}e${exp}`;
}

function viewState(state) {
  state.bits = clampBits(state.bits);
  const effects = calcEffects(state);
  const baseBits = calcBaseBits(state, effects);
  const multiplier = calcMultiplier(state.fever);
  const finalBits = baseBits.mul(state.sacrificeMult).mul(multiplier);
  const sacrificeRaw = calcSacrificeRewardFromPoints(state.sacrificePoints);
  const sacrificeRewardResult = applySacrificeSoftCap(sacrificeRaw);
  const sacrificeNextRaw = calcSacrificeRewardFromPoints(
    state.sacrificePoints.add(baseBits)
  );
  const sacrificeNextResult = applySacrificeSoftCap(sacrificeNextRaw);
  const sacrificeDelta = sacrificeNextResult.value.sub(sacrificeRewardResult.value);
  const runtimeLevel = state.layers.runtime.level;
  const totalBase = LAYERS.reduce((sum, layer) => {
    return sum.add(state.layers[layer.id].baseLevel);
  }, new Decimal(0));
  const prestigeGain = LAYERS.reduce((sum, layer) => {
    const layerState = state.layers[layer.id];
    const totalLevel = getTotalLevel(layerState);
    const gainedBase = totalLevel.mul(PRESTIGE_BASE_PERCENT).floor();
    const diff = gainedBase.sub(layerState.baseLevel);
    return sum.add(Decimal.max(new Decimal(0), diff));
  }, new Decimal(0));

  const layers = LAYERS.map((layer) => {
    const layerState = state.layers[layer.id];
    const effect = effects[layer.id];
    const cost = calcLayerCost(state, layer.id);
    const totalLevel = getTotalLevel(layerState);
    const remainingToTier = getNextTierRemaining(totalLevel, effect.tier);
    const canBuy = state.bits.gte(cost);

    return {
      id: layer.id,
      name: layer.name,
      level: layerState.level.toString(),
      delivered: layerState.delivered.toString(),
      baseLevel: layerState.baseLevel.toString(),
      tier: effect.tier,
      c: effect.c.toString(),
      e: effect.e.toString(),
      cost: cost.toString(),
      levelText: `(${formatDecimal(layerState.level)}+${formatDecimal(layerState.baseLevel)})`,
      deliveredText: formatDecimal(layerState.delivered),
      baseLevelText: formatDecimal(layerState.baseLevel),
      totalLevelText: formatDecimal(totalLevel),
      nextTierText: formatDecimal(new Decimal(remainingToTier)),
      cText: formatDecimal(effect.c),
      eText: formatDecimal(effect.e),
      costText: formatDecimal(cost),
      canBuy,
      canBuyMax: canBuy,
      autoBuyEnabled: !!state.autoBuyEnabled[layer.id],
      autoBuyUnlocked: true
    };
  });

  const canBuyAny = layers.some((layer) => layer.canBuyMax);

  return {
    bits: state.bits.toString(),
    bitsText: formatDecimal(state.bits),
    baseBits: baseBits.toString(),
    baseBitsText: formatDecimal(baseBits),
    finalBits: finalBits.toString(),
    finalBitsText: formatDecimal(finalBits),
    fever: state.fever,
    feverText: state.fever.toFixed(1),
    multiplier,
    multiplierText: multiplier.toFixed(2),
    sacrificeMult: state.sacrificeMult.toString(),
    sacrificeMultText: formatDecimal(state.sacrificeMult),
    sacrificeRewardText: formatDecimal(sacrificeRewardResult.value),
    sacrificeNextRewardText: formatDecimal(sacrificeNextResult.value),
    sacrificeSoftCapped: sacrificeRewardResult.softCapped,
    sacrificeNextSoftCapped: sacrificeNextResult.softCapped,
    totalBaseText: formatDecimal(totalBase),
    prestigeGainText: formatDecimal(prestigeGain),
    prestigePercentText: `${(PRESTIGE_BASE_PERCENT * 100).toFixed(0)}%`,
    canSacrifice: baseBits.gte(1) && sacrificeDelta.gte(0.1),
    canPrestige: runtimeLevel.gte(1) && prestigeGain.gte(1),
    canBuyAny,
    layers
  };
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

function calcSacrificeRewardFromPoints(points) {
  const one = new Decimal(1);
  return one.add(new Decimal(SACRIFICE_S).mul(points.add(1).log10()));
}

function applySacrificeSoftCap(mult) {
  const capStart = new Decimal(SACRIFICE_SOFTCAP_START);
  if (mult.lte(capStart)) {
    return { value: mult, softCapped: false };
  }
  const capped = capStart.add(mult.sub(capStart).div(SACRIFICE_SOFTCAP_DIVISOR));
  return { value: capped, softCapped: true };
}

function resetLayersToBase(state) {
  for (const layer of LAYERS) {
    const layerState = state.layers[layer.id];
    layerState.level = new Decimal(0);
    layerState.delivered = new Decimal(0);
  }
}

function doSacrifice(state) {
  const effects = calcEffects(state);
  const baseBits = calcBaseBits(state, effects);
  if (baseBits.lt(1)) {
    return false;
  }
  state.sacrificePoints = state.sacrificePoints.add(baseBits);
  state.sacrificeMult = applySacrificeSoftCap(
    calcSacrificeRewardFromPoints(state.sacrificePoints)
  ).value;
  state.bits = new Decimal(10);
  resetLayersToBase(state);
  return true;
}

function doPrestige(state) {
  const runtimeLevel = state.layers.runtime.level;
  if (runtimeLevel.lt(1)) {
    return false;
  }

  for (const layer of LAYERS) {
    const layerState = state.layers[layer.id];
    const totalLevel = getTotalLevel(layerState);
    const gainedBase = totalLevel.mul(PRESTIGE_BASE_PERCENT).floor();
    if (gainedBase.gt(layerState.baseLevel)) {
      layerState.baseLevel = gainedBase;
    }
  }

  state.sacrificeMult = new Decimal(1);
  state.sacrificePoints = new Decimal(0);
  state.bits = new Decimal(10);
  resetLayersToBase(state);
  return true;
}

function addBits(state, amount) {
  state.bits = clampBits(state.bits.add(amount));
}

function resetProgress(state) {
  state.bits = new Decimal(10);
  state.fever = 0;
  state.sacrificeMult = new Decimal(1);
  state.sacrificePoints = new Decimal(0);
  for (const layer of LAYERS) {
    state.autoBuyEnabled[layer.id] = false;
  }
  for (const layer of LAYERS) {
    state.layers[layer.id].level = new Decimal(0);
    state.layers[layer.id].delivered = new Decimal(0);
    state.layers[layer.id].baseLevel = new Decimal(0);
  }
}

module.exports = {
  createGameState,
  serializeGameState,
  applyDelta,
  viewState,
  calcMultiplier,
  purchaseLayer,
  purchaseMaxLayer,
  purchaseAllMax,
  doSacrifice,
  doPrestige,
  addBits,
  resetProgress
};
