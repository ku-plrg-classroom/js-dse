function classify(x, y) {
  if (isPositive(x) && isPositive(y)) {
    return max(x, y);
  }
  return 0;
}

function isPositive(n) {
  return n > 0;
}

function max(a, b) {
  return a > b ? a : b;
}
