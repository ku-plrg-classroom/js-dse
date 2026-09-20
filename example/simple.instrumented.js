function simple(x, y) {
  let z = __dse__.bin('*', __dse__.lit(2), x);
  if (__dse__.br(0, __dse__.bin('===', z, y))) {
    z = __dse__.bin('-', y, x);
    if (__dse__.br(1, __dse__.bin('<', x, z))) {
      return __dse__.lit(1);
    } else {
      return __dse__.lit(2);
    }
  } else {
    return __dse__.lit(3);
  }
}

