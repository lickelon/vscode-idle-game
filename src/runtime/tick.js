const { applyDelta } = require('../domain/progression');

function applyTick(state, seconds, active) {
  try {
    applyDelta(state, seconds, active);
  } catch (error) {
    console.error('[vscode-idle] tick failed:', error);
    state.tickSpeed = 1;
    state.fever = 0;
  }
}

module.exports = {
  applyTick
};
