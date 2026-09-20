function gcd(a, b) {
  if (__dse__.br(0, __dse__.bin('===', b, __dse__.lit(0)))) {
    return a;
  }
  return gcd(b, __dse__.bin('%', a, b));
}

