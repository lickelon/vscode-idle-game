const Decimal = require('../vendor/break_infinity.min.js');
const { LAYERS } = require('../constants');
const { clampBits } = require('../lib/utils');
const { applySacrificeSoftCap, calcSacrificeRewardFromPoints } = require('./sacrifice');

function toDecimal(value) {
  if (value instanceof Decimal) {
    return value;
  }
  try {
    return new Decimal(value || 0);
  } catch {
    return new Decimal(0);
  }
}

function normalizeDecimal(value, fallback = 0) {
  const decimal = toDecimal(value);
  if (Number.isNaN(decimal.m) || Number.isNaN(decimal.e)) {
    return new Decimal(fallback);
  }
  if (!Number.isFinite(decimal.m) || !Number.isFinite(decimal.e)) {
    return new Decimal(fallback);
  }
  if (decimal.lt(0)) {
    return new Decimal(0);
  }
  return decimal;
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveFiniteNumber(value, fallback) {
  const parsed = toFiniteNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function toTimestamp(value, fallback) {
  const parsed = toFiniteNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function createLayerState(savedLayer) {
  return {
    level: normalizeDecimal(savedLayer?.level || 0),
    delivered: normalizeDecimal(savedLayer?.delivered || 0),
    baseLevel: normalizeDecimal(savedLayer?.baseLevel || 0)
  };
}

function createGameState(saved) {
  const layers = {};
  for (const layer of LAYERS) {
    layers[layer.id] = createLayerState(saved?.layers?.[layer.id]);
  }

  const bits = clampBits(normalizeDecimal(saved?.bits || 0));
  const autoBuyEnabled = {};
  for (const layer of LAYERS) {
    autoBuyEnabled[layer.id] = !!saved?.autoBuyEnabled?.[layer.id];
  }

  const now = Date.now();
  const state = {
    bits,
    sacrificePoints: normalizeDecimal(saved?.sacrificePoints || 0),
    sacrificeMult: normalizeDecimal(saved?.sacrificeMult || 1, 1),
    fever: Math.max(0, toFiniteNumber(saved?.fever, 0)),
    lastTick: toTimestamp(saved?.lastTick, now),
    lastInput: Math.max(0, toFiniteNumber(saved?.lastInput, 0)),
    tickSpeed: toPositiveFiniteNumber(saved?.tickSpeed, 1),
    lastResetAt: toTimestamp(saved?.lastResetAt, now),
    lastSacrificeAt: toTimestamp(saved?.lastSacrificeAt, now),
    lastPrestigeAt: toTimestamp(saved?.lastPrestigeAt, now),
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
    tickSpeed: state.tickSpeed,
    lastResetAt: state.lastResetAt,
    lastSacrificeAt: state.lastSacrificeAt,
    lastPrestigeAt: state.lastPrestigeAt,
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
  state.lastResetAt = Date.now();
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
