function unreachable(x, y) {
  if (x > 10) {
    if (x < 5) {
      return 1;
    }
    if (y === x + 1) {
      if (y < x) {
        return 2;
      }
      return 3;
    }
  }
  return 4;
}
