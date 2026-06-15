import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { onModAction } from "./triggers";
import { handleMopCommentsMenu } from "./menus";
import { handleMopCommentsForm } from "./forms";

const application = new Hono();

// Triggers
application.post("/internal/triggers/mod-action", onModAction);

// Menus
application.post("/internal/menus/mop-comments", handleMopCommentsMenu);

// Forms
application.post("/internal/forms/mop-comments", handleMopCommentsForm);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
