function bool(flag, x) {
  let ok = flag;
  if (__dse__.br(0, __dse__.un('!', ok))) {
    ok = __dse__.bin('>', x, __dse__.lit(10));
  }
  if (__dse__.br(1, __dse__.and(2, ok, () => __dse__.bin('!==', x, __dse__.lit(42))))) {
    return __dse__.lit(1);
  }
  return __dse__.lit(0);
}

