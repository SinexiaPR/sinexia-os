/** Las server actions devuelven `{ error }` o un objeto de éxito. */
export function messageFrom(
  result: { error: string } | object,
  okMessage: string,
) {
  return "error" in result ? (result as { error: string }).error : okMessage;
}
