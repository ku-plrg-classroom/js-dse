function dowhile(x) {
  let i = 0;
  do {
    if (x === i) {
      return i;
    }
    i = i + 1;
  } while (i < 3);
  return -1;
}
