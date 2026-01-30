const Decimal = require('../vendor/break_infinity.min.js');
const {
  FEVER_GAIN_PER_SEC,
  MULT_DECAY_PER_SEC,
  DELIVERED_RATE,
  DELIVERED_PRESTIGE_BOOST,
  DELIVERED_SACRIFICE_BOOST,
  LAYERS
} = require('../constants');
const { clampBits } = require('../lib/utils');
const { calcEffects, calcBaseBits } = require('./effects');
const { calcMultiplier, feverFromMultiplier } = require('./fever');
const { purchaseMaxLayer } = require('./purchases');

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
  const baseBits = calcBaseBits(effects);
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

module.exports = {
  applyDelta
};
