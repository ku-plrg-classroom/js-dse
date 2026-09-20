function skip(x) {
  let sum = __dse__.lit(0);
  for (let i = __dse__.lit(0); __dse__.br(0, __dse__.bin('<', i, __dse__.lit(4))); __dse__.post(i, () => i = __dse__.bin('+', i, __dse__.lit(1)))) {
    if (__dse__.br(1, __dse__.bin('===', i, x))) continue;
    sum = __dse__.bin('+', sum, i);
  }
  return sum;
}

