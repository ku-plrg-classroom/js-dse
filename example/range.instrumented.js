function range(x, y) {
  if (__dse__.br(0, __dse__.and(1, __dse__.bin('>=', x, __dse__.lit(0)), () => __dse__.bin('<=', x, __dse__.lit(9))))) {
    return __dse__.br(2, __dse__.bin('!==', y, x)) ? __dse__.lit(1) : __dse__.lit(2);
  }
  return __dse__.lit(0);
}

