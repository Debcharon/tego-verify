export function renderCaptcha(api, container, config, colorScheme, callbacks) {
  const options = {
    sitekey: config.siteKey,
    callback: callbacks.solved,
    "expired-callback": callbacks.expired,
    "error-callback": callbacks.failed,
  };
  if (config.provider === "turnstile") {
    options.action = "tego_verify";
    options.theme = "auto";
  } else if (config.provider === "hcaptcha") {
    options.theme = colorScheme === "dark" ? "dark" : "light";
  } else {
    throw new Error("unsupported CAPTCHA provider");
  }
  const widgetID = api.render(container, options);
  return {
    reset: () => api.reset(widgetID),
    dispose: () => {
      if (typeof api.remove === "function") api.remove(widgetID);
      else container.replaceChildren();
    },
  };
}
