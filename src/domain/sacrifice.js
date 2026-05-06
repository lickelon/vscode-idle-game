const Decimal = require('../vendor/break_infinity.min.js');
const {
  SACRIFICE_S,
  SACRIFICE_SOFTCAP_START,
  SACRIFICE_SOFTCAP_SCALE
} = require('../constants');
const { applyLogSoftCap } = require('./softcap');

function calcSacrificeRewardFromPoints(points) {
  const one = new Decimal(1);
  return one.add(new Decimal(SACRIFICE_S).mul(points.add(1).log10()));
}

function applySacrificeSoftCap(mult) {
  return applyLogSoftCap(mult, SACRIFICE_SOFTCAP_START, SACRIFICE_SOFTCAP_SCALE);
}

module.exports = {
  calcSacrificeRewardFromPoints,
  applySacrificeSoftCap
};
