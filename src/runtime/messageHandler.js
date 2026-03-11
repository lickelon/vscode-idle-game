const { purchaseLayer, purchaseMaxLayer, purchaseAllMax } = require('../domain/purchases');
const { doSacrifice, doPrestige } = require('../domain/resets');
const { clampBits } = require('../lib/utils');

function createMessageHandler({ state, persist, updateStatus, syncAll, resetProgress }) {
  function addBits(amount) {
    state.bits = clampBits(state.bits.add(amount));
  }

  function commitWithStatus() {
    persist();
    updateStatus();
    syncAll();
  }

  function commitWithoutStatus() {
    persist();
    syncAll();
  }

  return function handleMessage(message) {
    if (message.type === 'buyLayer') {
      if (purchaseLayer(state, message.layerId)) {
        commitWithStatus();
      }
      return;
    }

    if (message.type === 'buyLayerMax') {
      if (purchaseMaxLayer(state, message.layerId)) {
        commitWithStatus();
      }
      return;
    }

    if (message.type === 'buyAllMax') {
      if (purchaseAllMax(state)) {
        commitWithStatus();
      }
      return;
    }

    if (message.type === 'sacrifice') {
      if (doSacrifice(state)) {
        commitWithStatus();
      }
      return;
    }

    if (message.type === 'prestige') {
      if (doPrestige(state)) {
        commitWithStatus();
      }
      return;
    }

    if (message.type === 'debugAddBits') {
      addBits(message.amount || '0');
      commitWithStatus();
      return;
    }

    if (message.type === 'setTickSpeed') {
      const speed = Number(message.speed || 1);
      state.tickSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
      commitWithoutStatus();
      return;
    }

    if (message.type === 'debugReset') {
      resetProgress(state);
      commitWithStatus();
      return;
    }

    if (message.type === 'toggleAutoBuy') {
      if (message.layerId && state.autoBuyEnabled) {
        state.autoBuyEnabled[message.layerId] = !!message.enabled;
      }
      commitWithoutStatus();
    }
  };
}

module.exports = {
  createMessageHandler
};
