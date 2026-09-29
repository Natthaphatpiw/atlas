let pendingForwardPath: string | null = null;

export function navigateForward(router: { push: (path: string, options?: { scroll?: boolean }) => void }, path: string) {
  pendingForwardPath = path;
  router.push(path, { scroll: true });
}

export function consumeForwardPath(path: string) {
  const shouldReset = pendingForwardPath === path;
  pendingForwardPath = null;
  return shouldReset;
}
