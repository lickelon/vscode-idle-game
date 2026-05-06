const Decimal = require('../vendor/break_infinity.min.js');

function applyLogSoftCap(value, start, scale) {
  const decimal = value instanceof Decimal ? value : new Decimal(value);
  const capStart = new Decimal(start);

  if (decimal.lte(capStart)) {
    return { value: decimal, softCapped: false };
  }

  const capScale = new Decimal(scale);
  const capped = capStart.add(
    capScale.mul(decimal.sub(capStart).div(capScale).add(1).ln())
  );

  return { value: capped, softCapped: true };
}

module.exports = {
  applyLogSoftCap
};
