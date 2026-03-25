import { Hono } from "hono";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.text("fitzRoy-ts");
});

export default app;
