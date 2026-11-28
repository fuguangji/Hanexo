export function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export const formatAmount = amount => (Number.isInteger(amount) ? String(amount) : amount.toFixed(1));

export function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const inventoryTotal = inventory => Object.values(inventory).reduce((sum, amount) => sum + amount, 0);
