export function allowsLocalFixtures(location: {
  readonly protocol: string;
  readonly hostname: string;
}): boolean {
  if (location.protocol !== "http:" && location.protocol !== "https:") return false;
  return location.hostname === "127.0.0.1"
    || location.hostname === "localhost"
    || location.hostname === "::1";
}
