import { defineApp } from "convex/server";
import dodopayments from "@dodopayments/convex/convex.config";

const app = defineApp();

// TODO: Register betterAuth component when PR #1812 merges
// import betterAuth from "@convex-dev/better-auth/convex.config";
// app.use(betterAuth);

app.use(dodopayments);

export default app;
