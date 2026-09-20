function parity(n) {
  if (__dse__.br(0, __dse__.bin('<', n, __dse__.lit(0)))) {
    return __dse__.un('-', __dse__.lit(1));
  }
  return __dse__.br(1, isEven(n)) ? __dse__.lit(1) : __dse__.lit(0);
}
function isEven(n) {
  if (__dse__.br(2, __dse__.bin('===', n, __dse__.lit(0)))) {
    return __dse__.lit(true);
  }
  return isOdd(__dse__.bin('-', n, __dse__.lit(1)));
}
function isOdd(n) {
  if (__dse__.br(3, __dse__.bin('===', n, __dse__.lit(0)))) {
    return __dse__.lit(false);
  }
  return isEven(__dse__.bin('-', n, __dse__.lit(1)));
}

