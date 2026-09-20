function loop(x) {
  let i = 0;
  while (i < 3) {
    if (i * 2 + 1 === x) {
      break;
    }
    i = i + 1;
  }
  return i;
}
