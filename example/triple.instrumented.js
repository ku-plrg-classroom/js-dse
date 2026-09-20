function triple(a, b) {
  if (__dse__.br(0, __dse__.bin('>=', a, __dse__.lit(10)))) {
    if (__dse__.br(1, __dse__.bin('===', b, __dse__.bin('*', __dse__.lit(2), a)))) {
      if (__dse__.br(2, __dse__.bin('>', __dse__.bin('+', a, b), __dse__.lit(100)))) {
        return __dse__.lit(1);
      }
    }
  }
  return __dse__.lit(0);
}

