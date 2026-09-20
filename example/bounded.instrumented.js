function bounded(x) {
  let n = __dse__.lit(0);
  while (__dse__.br(0, __dse__.bin('<', n, x))) {
    n = __dse__.bin('+', n, __dse__.lit(2));
  }
  return n;
}

