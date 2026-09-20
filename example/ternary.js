function ternary(x, y) {
  const m = x < y ? y : x;
  return m === 0 ? -1 : m;
}
