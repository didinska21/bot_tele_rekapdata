// state.js
const userStates = new Map(); // key: userId, value: { mode, ... }

const getState = (userId) => userStates.get(userId) || {};

const setState = (userId, newState) => {
  const current = userStates.get(userId) || {};
  userStates.set(userId, { ...current, ...newState });
};

const clearState = (userId) => {
  userStates.delete(userId);
};

module.exports = {
  getState,
  setState,
  clearState,
};
