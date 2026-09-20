function hashed(x, y) {
  const z = __dse__.hash(x);
  if (__dse__.br(0, __dse__.bin('>', x, __dse__.lit(5)))) {
    if (__dse__.br(1, __dse__.bin('===', z, y))) {
      return __dse__.lit(1);
    }
    return __dse__.lit(2);
  }
  return __dse__.lit(3);
}

