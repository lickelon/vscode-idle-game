const Decimal = require('./vendor/break_infinity.min.js');
const {
  FEVER_GAIN_PER_SEC,
  MULT_DECAY_PER_SEC,
  SOFT_CAP_K,
  SOFT_CAP_S,
  TIER_GROWTH,
  DELIVERED_RATE,
  RUNTIME_EXP_FACTOR,
  LAYERS
} = require('./constants');

const LAYER_INDEX = Object.fromEntries(LAYERS.map((layer, index) => [layer.id, index]));

function toDecimal(value) {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value || 0);
}

function createLayerState(savedLayer) {
  return {
    level: toDecimal(savedLayer?.level || 0),
    delivered: toDecimal(savedLayer?.delivered || 0)
  };
}

function createGameState(saved) {
  const layers = {};
  for (const layer of LAYERS) {
    layers[layer.id] = createLayerState(saved?.layers?.[layer.id]);
  }

  const bits = toDecimal(saved?.bits || 0);
  const state = {
    bits,
    fever: saved?.fever || 0,
    lastTick: saved?.lastTick || Date.now(),
    lastInput: saved?.lastInput || 0,
    layers
  };

  const allZero = LAYERS.every((layer) => state.layers[layer.id].level.eq(0));
  if (bits.eq(0) && allZero) {
    state.bits = new Decimal(10);
    state.layers.typing.level = new Decimal(1);
  }

  return state;
}

function serializeGameState(state) {
  const layers = {};
  for (const layer of LAYERS) {
    const layerState = state.layers[layer.id];
    layers[layer.id] = {
      level: layerState.level.toString(),
      delivered: layerState.delivered.toString()
    };
  }

  return {
    bits: state.bits.toString(),
    fever: state.fever,
    lastTick: state.lastTick,
    lastInput: state.lastInput,
    layers
  };
}

function getTier(level) {
  return Math.floor(level.div(10).floor().toNumber()) + 1;
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

function calcLayerEffect(state, layerId, runtimeEffect) {
  const layerState = state.layers[layerId];
  const tier = getTier(layerState.level);
  const c = layerState.level.add(layerState.delivered);
  let e = c.mul(tier);

  if (layerId === 'typing') {
    e = e.pow(runtimeEffect);
  }

  return {
    tier,
    c,
    e
  };
}

function calcEffects(state) {
  const effects = {};
  const runtimeBase = calcLayerEffect(state, 'runtime', 1).e;
  const runtimeFactor = 1 + RUNTIME_EXP_FACTOR * runtimeBase.toNumber();

  for (const layer of LAYERS) {
    const runtimeEffect = layer.id === 'typing' ? runtimeFactor : 1;
    effects[layer.id] = calcLayerEffect(state, layer.id, runtimeEffect);
  }

  return effects;
}

function calcBaseBits(state, effects) {
  const one = new Decimal(1);
  return effects.typing.e
    .mul(one.add(effects.assembly.e))
    .mul(one.add(effects.compiler.e))
    .mul(one.add(effects.high.e))
    .mul(one.add(effects.runtime.e));
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
  const gain = baseBits.mul(avgMult * seconds);
  state.bits = state.bits.add(gain);

  state.layers.assembly.delivered = state.layers.assembly.delivered.add(
    effects.compiler.e.mul(DELIVERED_RATE * seconds)
  );
  state.layers.compiler.delivered = state.layers.compiler.delivered.add(
    effects.high.e.mul(DELIVERED_RATE * seconds)
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
  const effects = calcEffects(state);
  const baseBits = calcBaseBits(state, effects);
  const multiplier = calcMultiplier(state.fever);
  const finalBits = baseBits.mul(multiplier);

  const layers = LAYERS.map((layer) => {
    const layerState = state.layers[layer.id];
    const effect = effects[layer.id];
    const cost = calcLayerCost(state, layer.id);

    return {
      id: layer.id,
      name: layer.name,
      level: layerState.level.toString(),
      delivered: layerState.delivered.toString(),
      tier: effect.tier,
      c: effect.c.toString(),
      e: effect.e.toString(),
      cost: cost.toString(),
      levelText: formatDecimal(layerState.level),
      deliveredText: formatDecimal(layerState.delivered),
      cText: formatDecimal(effect.c),
      eText: formatDecimal(effect.e),
      costText: formatDecimal(cost)
    };
  });

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
  const level = state.layers[layerId].level;
  const growth = new Decimal(layer.growth);
  const tierCost = calcTierCost(level);
  const base = new Decimal(layer.baseCost);
  const startCost = base.mul(growth.pow(level)).mul(tierCost);
  const nextTierLevel = getTier(level) * 10;
  const maxLevelsThisTier = nextTierLevel - level.toNumber();

  if (maxLevelsThisTier <= 0) {
    return false;
  }

  const rhs = state.bits.mul(growth.sub(1)).div(startCost).add(1);
  if (rhs.lte(1)) {
    return false;
  }

  const maxAffordable = Math.floor(rhs.log(layer.growth));
  const toBuy = Math.min(maxAffordable, maxLevelsThisTier);
  if (toBuy <= 0) {
    return false;
  }

  const totalCost = sumGeometricSeries(startCost, growth, toBuy);
  if (state.bits.lt(totalCost)) {
    return false;
  }

  state.bits = state.bits.sub(totalCost);
  state.layers[layerId].level = level.add(toBuy);
  return true;
}

function addBits(state, amount) {
  state.bits = state.bits.add(amount);
}

function resetProgress(state) {
  state.bits = new Decimal(10);
  state.fever = 0;
  for (const layer of LAYERS) {
    state.layers[layer.id].level = new Decimal(0);
    state.layers[layer.id].delivered = new Decimal(0);
  }
  state.layers.typing.level = new Decimal(1);
}

module.exports = {
  createGameState,
  serializeGameState,
  applyDelta,
  viewState,
  calcMultiplier,
  purchaseLayer,
  purchaseMaxLayer,
  addBits,
  resetProgress
};
