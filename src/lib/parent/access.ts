import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const PARENT_MODE_COOKIE = "farytale-parent";
export const PARENT_MODE_VALUE = "1";

export function isParentModeCookieValue(value: string | undefined) {
  return value === PARENT_MODE_VALUE;
}

export async function hasParentMode() {
  const cookieStore = await cookies();
  return isParentModeCookieValue(cookieStore.get(PARENT_MODE_COOKIE)?.value);
}

export async function requireParentMode() {
  if (!(await hasParentMode())) {
    redirect("/parent");
  }
}
