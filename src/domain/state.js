const Decimal = require('../vendor/break_infinity.min.js');
const { LAYERS } = require('../constants');
const { clampBits } = require('../lib/utils');
const { applySacrificeSoftCap, calcSacrificeRewardFromPoints } = require('./sacrifice');

function toDecimal(value) {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value || 0);
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

function resetLayersToBase(state) {
  for (const layer of LAYERS) {
    const layerState = state.layers[layer.id];
    layerState.level = new Decimal(0);
    layerState.delivered = new Decimal(0);
  }
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
  toDecimal,
  createLayerState,
  createGameState,
  serializeGameState,
  resetLayersToBase,
  resetProgress
};
