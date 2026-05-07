import { generateSecurePassword } from "../../utils/password.js";

describe("Password Utility", () => {
  it("should generate a secure password of default length 12", () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(12);
  });

  it("should generate a password of specified length", () => {
    const password = generateSecurePassword(16);
    expect(password).toHaveLength(16);
  });

  it("should not contain unsafe characters (+, /, =)", () => {
    const password = generateSecurePassword(50);
    expect(password).not.toMatch(new RegExp('[+/=]'));
  });
});