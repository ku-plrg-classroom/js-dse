function dowhile(x) {
  let i = __dse__.lit(0);
  do {
    if (__dse__.br(1, __dse__.bin('===', x, i))) {
      return i;
    }
    i = __dse__.bin('+', i, __dse__.lit(1));
  } while (__dse__.br(0, __dse__.bin('<', i, __dse__.lit(3))));
  return __dse__.un('-', __dse__.lit(1));
}

