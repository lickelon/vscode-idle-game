const Decimal = require('../vendor/break_infinity.min.js');
const { PRESTIGE_BASE_PERCENT, LAYERS } = require('../constants');
const { clampBits, formatDecimal } = require('../lib/utils');
const { calcEffects, calcBaseBits, getTotalLevel } = require('../domain/effects');
const { getNextTierRemaining } = require('../domain/tiers');
const { calcMultiplier } = require('../domain/fever');
const { calcLayerCost } = require('../domain/purchases');
const { calcSacrificeRewardFromPoints, applySacrificeSoftCap } = require('../domain/sacrifice');

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) {
    return '0.0s';
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}m ${remainder.toFixed(0)}s`;
}

function viewState(state) {
  state.bits = clampBits(state.bits);
  const now = Date.now();
  const effects = calcEffects(state);
  const baseBits = calcBaseBits(effects);
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
  const resetElapsed = (now - (state.lastResetAt || now)) / 1000;
  const sacrificeElapsed = (now - (state.lastSacrificeAt || now)) / 1000;
  const prestigeElapsed = (now - (state.lastPrestigeAt || now)) / 1000;

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
    tickSpeed: state.tickSpeed || 1,
    resetElapsedText: formatSeconds(resetElapsed),
    sacrificeElapsedText: formatSeconds(sacrificeElapsed),
    prestigeElapsedText: formatSeconds(prestigeElapsed),
    layers
  };
}

module.exports = {
  viewState
};
