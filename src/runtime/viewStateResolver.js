function createViewStateResolver({ state, viewState, resetProgress }) {
  return function getViewState() {
    try {
      return viewState(state);
    } catch (error) {
      console.error('[vscode-idle] viewState failed:', error);
      resetProgress(state);
      try {
        return viewState(state);
      } catch (retryError) {
        console.error('[vscode-idle] viewState recovery failed:', retryError);
        return null;
      }
    }
  };
}

module.exports = {
  createViewStateResolver
};
