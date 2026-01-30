const Decimal = require('../vendor/break_infinity.min.js');
const {
  SACRIFICE_S,
  SACRIFICE_SOFTCAP_START,
  SACRIFICE_SOFTCAP_DIVISOR
} = require('../constants');

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

module.exports = {
  calcSacrificeRewardFromPoints,
  applySacrificeSoftCap
};
