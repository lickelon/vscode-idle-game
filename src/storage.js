function loadState(context) {
  return context.globalState.get('gameState') || {};
}

function saveState(context, state) {
  return context.globalState.update('gameState', state);
}

module.exports = {
  loadState,
  saveState
};
