import type { CaptchaProvider } from "./config";

export type CaptchaConfig = { provider: CaptchaProvider; siteKey: string };
export type CaptchaCallbacks = {
  solved: (token: string) => void;
  expired: () => void;
  failed: () => void;
};
export type CaptchaOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  action?: string;
  theme?: "auto" | "dark" | "light";
};
export type CaptchaAPI = {
  render: (container: HTMLElement, options: CaptchaOptions) => string | number;
  reset: (widgetID: string | number) => void;
  remove?: (widgetID: string | number) => void;
};

export function renderCaptcha(
  api: CaptchaAPI,
  container: HTMLElement,
  config: CaptchaConfig,
  colorScheme: string,
  callbacks: CaptchaCallbacks,
) {
  const options: CaptchaOptions = {
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
