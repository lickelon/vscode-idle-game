const Decimal = require('../vendor/break_infinity.min.js');
const {
  RUNTIME_EXP_FACTOR,
  TYPING_RUNTIME_POWER,
  TIER_POWER,
  PRESTIGE_TIER_BOOST,
  BASE_LEVEL_SOFTCAP_START,
  BASE_LEVEL_SOFTCAP_SCALE,
  LAYERS
} = require('../constants');
const { getTier } = require('./tiers');
const { applyLogSoftCap } = require('./softcap');

function getTotalLevel(layerState) {
  return layerState.level.add(layerState.baseLevel);
}

function getEffectiveBaseLevel(layerState) {
  return applyLogSoftCap(
    layerState.baseLevel,
    BASE_LEVEL_SOFTCAP_START,
    BASE_LEVEL_SOFTCAP_SCALE
  ).value;
}

function getEffectiveTotalLevel(layerState) {
  return layerState.level.add(getEffectiveBaseLevel(layerState));
}

function getEffectiveBaseTotal(state) {
  return LAYERS.reduce((sum, layer) => {
    return sum.add(getEffectiveBaseLevel(state.layers[layer.id]));
  }, new Decimal(0));
}

function calcLayerEffect(state, layerId, runtimeEffect, runtimeBoost, tierPower) {
  const layerState = state.layers[layerId];
  const totalLevel = getEffectiveTotalLevel(layerState);
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
  const effectiveBaseTotal = getEffectiveBaseTotal(state);
  const tierPower = TIER_POWER * (1 + effectiveBaseTotal.add(1).log10() * PRESTIGE_TIER_BOOST);
  const runtimeBase = calcLayerEffect(state, 'runtime', 1, null, tierPower).e;
  const runtimeFactor = 1 + RUNTIME_EXP_FACTOR * runtimeBase.toNumber();
  const runtimeBoost = new Decimal(runtimeBase.add(1).log10()).add(1);

  for (const layer of LAYERS) {
    const runtimeEffect = layer.id === 'typing' ? runtimeFactor : 1;
    effects[layer.id] = calcLayerEffect(state, layer.id, runtimeEffect, runtimeBoost, tierPower);
  }

  return {
    ...effects,
    effectiveBaseTotal
  };
}

function calcBaseBits(effects) {
  const one = new Decimal(1);
  return effects.typing.e
    .mul(one.add(effects.assembly.e))
    .mul(one.add(effects.compiler.e))
    .mul(one.add(effects.high.e))
    .mul(one.add(effects.runtime.e))
    .mul(one.add(effects.synthesis.e));
}

module.exports = {
  getTotalLevel,
  getEffectiveBaseLevel,
  getEffectiveTotalLevel,
  getEffectiveBaseTotal,
  calcEffects,
  calcBaseBits
};
