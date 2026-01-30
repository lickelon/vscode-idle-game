const { SOFT_CAP_K, SOFT_CAP_S } = require('../constants');

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

module.exports = {
  calcMultiplier,
  feverFromMultiplier
};
