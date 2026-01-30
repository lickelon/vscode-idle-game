const Decimal = require('../vendor/break_infinity.min.js');
const { PRESTIGE_BASE_PERCENT } = require('../constants');
const { calcEffects, calcBaseBits, getTotalLevel } = require('./effects');
const { calcSacrificeRewardFromPoints, applySacrificeSoftCap } = require('./sacrifice');
const { resetLayersToBase } = require('./state');

function doSacrifice(state) {
  const effects = calcEffects(state);
  const baseBits = calcBaseBits(effects);
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

  for (const layer of Object.values(state.layers)) {
    const totalLevel = getTotalLevel(layer);
    const gainedBase = totalLevel.mul(PRESTIGE_BASE_PERCENT).floor();
    if (gainedBase.gt(layer.baseLevel)) {
      layer.baseLevel = gainedBase;
    }
  }

  state.sacrificeMult = new Decimal(1);
  state.sacrificePoints = new Decimal(0);
  state.bits = new Decimal(10);
  resetLayersToBase(state);
  return true;
}

module.exports = {
  doSacrifice,
  doPrestige
};
