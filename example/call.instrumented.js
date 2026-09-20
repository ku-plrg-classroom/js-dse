function classify(x, y) {
  if (__dse__.br(0, __dse__.and(1, isPositive(x), () => isPositive(y)))) {
    return max(x, y);
  }
  return __dse__.lit(0);
}
function isPositive(n) {
  return __dse__.bin('>', n, __dse__.lit(0));
}
function max(a, b) {
  return __dse__.br(2, __dse__.bin('>', a, b)) ? a : b;
}

