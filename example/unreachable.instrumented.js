function unreachable(x, y) {
  if (__dse__.br(0, __dse__.bin('>', x, __dse__.lit(10)))) {
    if (__dse__.br(1, __dse__.bin('<', x, __dse__.lit(5)))) {
      return __dse__.lit(1);
    }
    if (__dse__.br(2, __dse__.bin('===', y, __dse__.bin('+', x, __dse__.lit(1))))) {
      if (__dse__.br(3, __dse__.bin('<', y, x))) {
        return __dse__.lit(2);
      }
      return __dse__.lit(3);
    }
  }
  return __dse__.lit(4);
}

