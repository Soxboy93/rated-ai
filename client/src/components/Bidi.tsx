/**
 * Text that may be a maths expression ("2/7 + 3/7 = ؟") inside right-to-left Arabic. An expression with no Arabic
 * words must read left to right; anything with Arabic words keeps the surrounding direction.
 */
export const isExpression = (text: string) => !/[ء-ي]/.test(text.replace(/؟/g, "")) && /\d/.test(text);

export default function Bidi({ children }: { children: string }) {
  return isExpression(children) ? <bdi dir="ltr" style={{ display: "inline-block" }}>{children}</bdi> : <bdi>{children}</bdi>;
}
