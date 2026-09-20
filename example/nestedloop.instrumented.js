function nestedloop(x, y) {
  let hits = __dse__.lit(0);
  for (let i = __dse__.lit(0); __dse__.br(0, __dse__.bin('<', i, __dse__.lit(2))); __dse__.post(i, () => i = __dse__.bin('+', i, __dse__.lit(1)))) {
    for (let j = __dse__.lit(0); __dse__.br(1, __dse__.bin('<', j, __dse__.lit(2))); __dse__.post(j, () => j = __dse__.bin('+', j, __dse__.lit(1)))) {
      if (__dse__.br(2, __dse__.and(3, __dse__.bin('===', x, i), () => __dse__.bin('===', y, j)))) {
        __dse__.post(hits, () => hits = __dse__.bin('+', hits, __dse__.lit(1)));
      }
    }
  }
  return hits;
}

