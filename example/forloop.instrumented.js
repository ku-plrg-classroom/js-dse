function forloop(x) {
  let count = __dse__.lit(0);
  for (let i = __dse__.lit(0); __dse__.br(0, __dse__.bin('<', i, __dse__.lit(3))); __dse__.post(i, () => i = __dse__.bin('+', i, __dse__.lit(1)))) {
    if (__dse__.br(1, __dse__.bin('>', x, __dse__.bin('*', i, __dse__.lit(10))))) {
      count = __dse__.bin('+', count, __dse__.lit(1));
    }
  }
  return count;
}

