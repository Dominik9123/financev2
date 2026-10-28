import { postJson, requestApi } from "./financeApi";

export function parseSessionUser(data) {
  if (!data || typeof data.id !== "string" || !data.id.trim()
    || typeof data.email !== "string" || !data.email.trim()
    || typeof data.firstName !== "string" || typeof data.lastName !== "string") {
    throw new Error("Invalid account response.");
  }
  return { id: data.id, email: data.email, firstName: data.firstName, lastName: data.lastName };
}

export async function fetchSessionUser(signal) {
  const response = await requestApi("/auth/me", { method: "GET", signal });
  return parseSessionUser(await response.json());
}

export async function signIn(email, password, rememberMe) {
  const response = await postJson("/auth/login", { email: email.trim(), password, rememberMe });
  return parseSessionUser(await response.json());
}
