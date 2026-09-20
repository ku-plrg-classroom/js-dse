function loop(x) {
  let i = __dse__.lit(0);
  while (__dse__.br(0, __dse__.bin('<', i, __dse__.lit(3)))) {
    if (__dse__.br(1, __dse__.bin('===', __dse__.bin('+', __dse__.bin('*', i, __dse__.lit(2)), __dse__.lit(1)), x))) {
      break;
    }
    i = __dse__.bin('+', i, __dse__.lit(1));
  }
  return i;
}

