import request from "supertest";
import app from "../server.js";

describe("App Health & Server Checks", () => {
  it("should return status 'up' for the /health endpoint", async () => {
    const res = await request(app).get("/health");
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("status", "up");
    expect(res.body).toHaveProperty("env");
  });
});