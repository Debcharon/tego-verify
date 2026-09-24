import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];

for (const provider of ["turnstile", "hcaptcha"]) {
  test(`Mini App renders and submits ${provider}`, async () => {
    const elements = Object.fromEntries(["title", "description", "submit", "foot", "status"]
      .map(id => [id, { textContent: "", disabled: true, addEventListener(_type, handler) { this.click = handler; } }]));
    let widgetOptions;
    let resetCount = 0;
    let sentProof;
    let requestBody;
    let verifyCalls = 0;
    const api = {
      render(id, options) {
        assert.equal(id, provider === "turnstile" ? "#widget" : "widget");
        widgetOptions = options;
        return 7;
      },
      reset(id) {
        assert.equal(id, 7);
        resetCount++;
      },
    };
    const webApp = { ready() {}, expand() {}, sendData(value) { sentProof = value; } };
    const window = {
      Telegram: { WebApp: webApp },
      matchMedia: () => ({ matches: false }),
      turnstile: api,
      hcaptcha: api,
    };
    const context = {
      navigator: { language: "en" },
      location: { search: "?challenge=signed-challenge" },
      URLSearchParams,
      window,
      document: {
        getElementById: id => elements[id],
        createElement: () => ({}),
        head: { append(node) {
          if (provider === "turnstile") {
            assert.match(node.src, /challenges\.cloudflare\.com/);
            node.onload();
          } else {
            assert.match(node.src, /js\.hcaptcha\.com/);
            window.tegoHCaptchaReady();
          }
        } },
      },
      fetch: async (url, options) => {
        if (url === "/api/config") return { ok: true, json: async () => ({ provider, siteKey: "site-key" }) };
        assert.equal(url, "/api/verify");
        requestBody = JSON.parse(options.body);
        verifyCalls++;
        if (verifyCalls === 1) return { ok: false, json: async () => ({ error: "retry" }) };
        return { ok: true, json: async () => ({ proof: "signed-proof" }) };
      },
    };
    runInNewContext(script, context);
    await new Promise(setImmediate);
    assert.equal(widgetOptions.sitekey, "site-key");
    assert.equal(elements.submit.disabled, true);
    widgetOptions.callback("captcha-token");
    assert.equal(elements.submit.disabled, false);
    await elements.submit.click();
    assert.equal(requestBody.challenge, "signed-challenge");
    assert.equal(requestBody.token, "captcha-token");
    assert.equal(resetCount, 1);
    assert.equal(sentProof, undefined);
    widgetOptions.callback("fresh-token");
    await elements.submit.click();
    assert.equal(requestBody.token, "fresh-token");
    assert.equal(sentProof, "signed-proof");
  });
}
