export type DebouncedFunction<Args extends unknown[]> = ((...args: Args) => void) & {
  cancel: () => void;
};

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): DebouncedFunction<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: Args | undefined;

  const debounced = ((...args: Args): void => {
    pendingArgs = args;

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      const argsToPass = pendingArgs;
      pendingArgs = undefined;

      if (argsToPass !== undefined) {
        fn(...argsToPass);
      }
    }, delay);
  }) as DebouncedFunction<Args>;

  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = undefined;
    pendingArgs = undefined;
  };

  return debounced;
}
