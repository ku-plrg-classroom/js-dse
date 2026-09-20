function modulo(x) {
  const r = __dse__.bin('%', x, __dse__.lit(3));
  if (__dse__.br(0, __dse__.bin('===', r, __dse__.lit(0)))) {
    return __dse__.lit(1);
  }
  if (__dse__.br(1, __dse__.bin('>', x, __dse__.lit(100)))) {
    return __dse__.lit(2);
  }
  return __dse__.lit(3);
}

