function update(x) {
  let n = x;
  if (__dse__.br(0, __dse__.bin('>', __dse__.post(n, () => n = __dse__.bin('+', n, __dse__.lit(1))), __dse__.lit(5)))) {
    return n;
  }
  if (__dse__.br(1, __dse__.bin('>', n = __dse__.bin('+', n, __dse__.lit(1)), __dse__.lit(5)))) {
    return __dse__.un('-', n);
  }
  __dse__.post(n, () => n = __dse__.bin('-', n, __dse__.lit(1)));
  return n = __dse__.bin('-', n, __dse__.lit(1));
}

