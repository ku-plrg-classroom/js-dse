function ternary(x, y) {
  const m = __dse__.br(0, __dse__.bin('<', x, y)) ? y : x;
  return __dse__.br(1, __dse__.bin('===', m, __dse__.lit(0))) ? __dse__.un('-', __dse__.lit(1)) : m;
}

