/**
 * A public, reproducible map slice. It deliberately identifies a public page
 * resource rather than a signed-in user, so a copied URL never falls back to
 * the recipient's private "my map" overlay.
 */
export type SharedMapScope = {
  type: "PROFILE" | "CLUB" | "SOURCE";
  id: string;
};

export function appendSharedMapScope(
  parameters: URLSearchParams,
  scope?: SharedMapScope,
): URLSearchParams {
  if (!scope) return parameters;
  parameters.set("scope", scope.type);
  parameters.set("scopeId", scope.id);
  return parameters;
}

export function parseSharedMapScope(
  parameters: URLSearchParams,
): SharedMapScope | null {
  const type = parameters.get("scope");
  const id = parameters.get("scopeId")?.trim();
  if (!id || (type !== "PROFILE" && type !== "CLUB" && type !== "SOURCE"))
    return null;
  return { type, id };
}
