import test from "node:test";
import assert from "node:assert/strict";
import { renderCaptcha } from "../lib/captcha-widget.js";

for (const provider of ["turnstile", "hcaptcha"]) {
  test(provider + " widget keeps verification callbacks and provider options", () => {
    const calls = [];
    const container = { replaceChildren() { calls.push("cleared"); } };
    const api = {
      render(target, options) {
        assert.equal(target, container);
        assert.equal(options.sitekey, "public-key");
        assert.equal(options.theme, provider === "turnstile" ? "auto" : "dark");
        if (provider === "turnstile") assert.equal(options.action, "tego_verify");
        else assert.equal(options.action, undefined);
        options.callback("valid-token");
        options["expired-callback"]();
        options["error-callback"]();
        return 7;
      },
      reset(id) { assert.equal(id, 7); calls.push("reset"); },
      remove(id) { assert.equal(id, 7); calls.push("removed"); },
    };
    const widget = renderCaptcha(api, container, { provider, siteKey: "public-key" }, "dark", {
      solved: token => calls.push(token),
      expired: () => calls.push("expired"),
      failed: () => calls.push("failed"),
    });
    widget.reset();
    widget.dispose();
    assert.deepEqual(calls, ["valid-token", "expired", "failed", "reset", "removed"]);
  });
}
