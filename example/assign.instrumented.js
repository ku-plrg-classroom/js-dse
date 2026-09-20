function assign(x, y) {
  let a = x;
  a = __dse__.bin('+', a, y);
  a = __dse__.bin('*', a, __dse__.lit(2));
  let b = __dse__.bin('-', a, x);
  if (__dse__.br(0, __dse__.bin('>', b, __dse__.lit(10)))) {
    b = __dse__.bin('-', b, __dse__.lit(10));
  }
  return __dse__.br(1, __dse__.bin('>', b, __dse__.lit(0))) ? b : __dse__.un('-', b);
}

