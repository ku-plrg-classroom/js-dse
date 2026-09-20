function nested(x, y) {
  let r = __dse__.lit(0);
  if (__dse__.br(0, __dse__.bin('>', x, __dse__.lit(0)))) {
    if (__dse__.br(1, __dse__.bin('>', y, __dse__.lit(0)))) {
      r = __dse__.lit(1);
    } else {
      r = __dse__.lit(2);
    }
  } else {
    if (__dse__.br(2, __dse__.bin('>', y, __dse__.lit(0)))) {
      r = __dse__.lit(3);
    } else {
      r = __dse__.lit(4);
    }
  }
  if (__dse__.br(3, __dse__.bin('===', r, __dse__.lit(1)))) {
    return r;
  }
  return __dse__.un('-', r);
}

