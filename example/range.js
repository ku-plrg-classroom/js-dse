function range(x, y) {
  if (x >= 0 && x <= 9) {
    return y !== x ? 1 : 2;
  }
  return 0;
}
