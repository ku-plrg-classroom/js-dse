function forever(x) {
  let n = __dse__.lit(0);
  if (__dse__.br(0, __dse__.bin('>', x, __dse__.lit(0)))) {
    for (; __dse__.br(1, __dse__.lit(true)); ) {
      n = __dse__.bin('+', n, __dse__.lit(1));
    }
  }
  return n;
}

