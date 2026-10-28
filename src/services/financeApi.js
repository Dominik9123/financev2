const API_URL = (
  process.env.REACT_APP_API_URL?.trim() || "http://localhost:5109/api"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status, validationMessage = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.validationMessage = validationMessage;
  }
}

// Mutations can return an empty body; callers only parse JSON when they need it.
export async function requestApi(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Cannot connect to the server. Check your connection and try again.", 0);
  }

  if (!response.ok) {
    let validationMessage = "";
    if (response.status === 400 || response.status === 409) {
      try {
        const body = await response.json();
        const messages = Array.isArray(body)
          ? body.map(error => error.description)
          : Object.values(body?.errors || {}).flat();
        validationMessage = [...new Set(messages.filter(message => typeof message === "string"))]
          .slice(0, 3).join(" ");
      } catch {
        // Empty and non-JSON error bodies still use the caller's safe fallback.
      }
    }
    throw new ApiError("The server could not complete the request.", response.status, validationMessage);
  }
  return response;
}

export async function fetchApiList(path) {
  const response = await requestApi(path);
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid list response.");
  }
  return data;
}

export function postJson(path, data) {
  return requestApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function apiErrorMessage(error, fallback) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please log in again.";
    if (error.status === 403) return "You do not have permission to perform this action.";
    if (error.status === 0) return error.message;
    if (error.validationMessage) return error.validationMessage;
  }
  return fallback;
}
