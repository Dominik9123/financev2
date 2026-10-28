import { categoryExists, getPasswordRequirements, isValidAmount, isValidPassword } from "./validation";

test.each(["0.01", "10", "10.12", "10.1200", "1000000000"])("valid monetary amount: %s", amount => {
  expect(isValidAmount(amount)).toBe(true);
});

test.each(["", "0", "-1", "0.001", "10.123", "1000000000.01", "NaN", Infinity])("invalid monetary amount: %s", amount => {
  expect(isValidAmount(amount)).toBe(false);
});

test.each(["food", " HOUSING ", "Income", "All"])("default or reserved category cannot be added: %s", name => {
  expect(categoryExists(name, [])).toBe(true);
});

test("category matching handles whitespace, case and canonically equivalent Unicode", () => {
  expect(categoryExists(" ŻYWNOŚĆ ", [{ name: "żywność" }])).toBe(true);
  expect(categoryExists("Cafe\u0301", [{ name: "Caf\u00e9" }])).toBe(true);
  expect(categoryExists("Books", [{ name: "School" }])).toBe(false);
});

test.each(["Ab1!", "abcdefgh1!", "Abcdefgh!", "Abcdefgh1", "A1!" + "a".repeat(126)])("weak or oversized password is rejected", password => {
  expect(isValidPassword(password)).toBe(false);
});

test("password hints and acceptance use the same rules", () => {
  expect(isValidPassword("ValidPass1/")).toBe(true);
  expect(getPasswordRequirements("ValidPass1/")).toEqual({ length: true, uppercase: true, number: true, special: true });
  expect(isValidPassword("A1!" + "a".repeat(125))).toBe(true);
});
