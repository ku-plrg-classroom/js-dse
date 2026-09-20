function sequence(x, y) {
  var lo = 0, hi = 0;
  for (lo = 0, hi = 4; lo < hi; lo++, hi--) {
    if (lo === x) {
      return hi;
    }
  }
  return (lo = x, hi = y, lo + hi);
}
