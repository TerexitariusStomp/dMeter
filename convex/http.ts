import { httpRouter } from "convex/server";
import { webhookHandler } from "./payments/webhookHandlers";

const http = httpRouter();

http.route({
  path: "/dodopayments-webhook",
  method: "POST",
  handler: webhookHandler,
});

export default http;
