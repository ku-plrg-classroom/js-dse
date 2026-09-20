function sequence(x, y) {
  var lo = __dse__.lit(0), hi = __dse__.lit(0);
  for ((lo = __dse__.lit(0), hi = __dse__.lit(4)); __dse__.br(0, __dse__.bin('<', lo, hi)); (__dse__.post(lo, () => lo = __dse__.bin('+', lo, __dse__.lit(1))), __dse__.post(hi, () => hi = __dse__.bin('-', hi, __dse__.lit(1))))) {
    if (__dse__.br(1, __dse__.bin('===', lo, x))) {
      return hi;
    }
  }
  return (lo = x, hi = y, __dse__.bin('+', lo, hi));
}

