const Decimal = require('../vendor/break_infinity.min.js');
const { HARD_CAP } = require('../constants');

function clampBits(value) {
  const cap = new Decimal(HARD_CAP);
  return value.gt(cap) ? cap : value;
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

module.exports = {
  clampBits,
  formatDecimal
};
