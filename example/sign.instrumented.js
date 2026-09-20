function sign(x) {
  const s = __dse__.br(0, __dse__.bin('>', x, __dse__.lit(0))) ? __dse__.lit(1) : __dse__.br(1, __dse__.bin('<', x, __dse__.lit(0))) ? __dse__.un('-', __dse__.lit(1)) : __dse__.lit(0);
  if (__dse__.br(2, __dse__.bin('<', __dse__.bin('*', s, x), __dse__.lit(0)))) {
    return __dse__.un('-', __dse__.lit(1));
  }
  return s;
}

