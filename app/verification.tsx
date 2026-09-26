"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { renderCaptcha } from "../lib/captcha-widget";
import type { CaptchaAPI, CaptchaConfig } from "../lib/captcha-widget";

type TelegramWebApp = {
  colorScheme: string;
  ready: () => void;
  expand: () => void;
  sendData: (data: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    turnstile?: CaptchaAPI;
    hcaptcha?: CaptchaAPI;
    tegoHCaptchaReady?: () => void;
  }
}

const messages = {
  en: {
    eyebrow: "Private message verification",
    title: "Verify to continue",
    description: "Complete this check before sending a private message to tego.",
    submit: "Verify and continue",
    foot: "After verification, return to the chat and send your message again.",
    loading: "Loading verification…",
    ready: "Complete the check above first.",
    sending: "Checking your response…",
    done: "Verified. Returning to Telegram…",
    invalid: "Open this page from the verification button in the tego chat.",
    failed: "The CAPTCHA was not accepted. Please complete it again.",
    expired: "This verification link is invalid or expired. Request a new button in the bot chat.",
    unavailable: "The verification service is unavailable. Please try again later.",
    network: "The request failed. Check your connection and try again.",
  },
  zh: {
    eyebrow: "私聊消息验证",
    title: "验证后继续",
    description: "完成验证后，才能向 tego 发送私聊消息。",
    submit: "验证并继续",
    foot: "验证通过后，请返回聊天并重新发送消息。",
    loading: "正在加载验证…",
    ready: "请先完成上方验证。",
    sending: "正在核验…",
    done: "验证已完成，正在返回 Telegram…",
    invalid: "请从 tego 聊天中的验证按钮打开此页面。",
    failed: "验证码未通过，请重新完成验证。",
    expired: "验证链接无效或已过期，请在机器人聊天中重新获取验证按钮。",
    unavailable: "验证服务暂时不可用，请稍后重试。",
    network: "请求失败，请检查网络后重试。",
  },
};

type Locale = keyof typeof messages;
type Phase = "loading" | "ready" | "solved" | "sending" | "done" | "invalid" |
  "failed" | "expired" | "unavailable" | "network";

export default function Verification() {
  const [locale, setLocale] = useState<Locale>("en");
  const [scriptReady, setScriptReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const resetWidget = useRef<() => void>(() => {});
  const telegramRef = useRef<TelegramWebApp | null>(null);
  const challengeRef = useRef("");
  const submitting = useRef(false);
  const copy = messages[locale];

  useEffect(() => {
    const selected = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    setLocale(selected);
    document.documentElement.lang = selected === "zh" ? "zh-CN" : "en";
  }, []);

  useEffect(() => {
    if (!scriptReady) return;
    let cancelled = false;
    let providerScript: HTMLScriptElement | undefined;
    let disposeWidget: () => void = () => {};
    const telegram = window.Telegram?.WebApp;
    const challenge = new URLSearchParams(window.location.search).get("challenge");
    if (!telegram || !challenge || challenge.length > 256) {
      setPhase("invalid");
      return;
    }
    telegramRef.current = telegram;
    challengeRef.current = challenge;
    document.documentElement.dataset.theme = telegram.colorScheme === "dark" ? "dark" : "light";
    telegram.ready();
    telegram.expand();
    setPhase("loading");

    async function begin() {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        if (!response.ok) throw new Error("configuration unavailable");
        const config = await response.json() as CaptchaConfig;
        if (!config.siteKey || !["turnstile", "hcaptcha"].includes(config.provider)) {
          throw new Error("unsupported provider");
        }
        if (cancelled) return;

        const solved = (value: string) => {
          if (cancelled) return;
          setToken(value);
          setPhase("solved");
        };
        const expired = () => {
          if (cancelled) return;
          setToken("");
          setPhase("ready");
        };
        const failed = () => {
          if (cancelled) return;
          setToken("");
          setPhase("failed");
        };
        const renderWidget = (api: CaptchaAPI | undefined) => {
          if (cancelled || !api || !widgetRef.current) return;
          try {
            setPhase("ready");
            const widget = renderCaptcha(api, widgetRef.current, config, telegram!.colorScheme, { solved, expired, failed });
            resetWidget.current = widget.reset;
            disposeWidget = widget.dispose;
          } catch {
            failed();
          }
        };

        if (config.provider === "turnstile" && window.turnstile) {
          renderWidget(window.turnstile);
          return;
        }
        if (config.provider === "hcaptcha" && window.hcaptcha) {
          renderWidget(window.hcaptcha);
          return;
        }
        providerScript = document.createElement("script");
        providerScript.async = true;
        providerScript.onerror = failed;
        if (config.provider === "turnstile") {
          providerScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          providerScript.onload = () => renderWidget(window.turnstile);
        } else {
          window.tegoHCaptchaReady = () => {
            renderWidget(window.hcaptcha);
            delete window.tegoHCaptchaReady;
          };
          providerScript.src = "https://js.hcaptcha.com/1/api.js?onload=tegoHCaptchaReady&render=explicit&recaptchacompat=off";
        }
        document.head.append(providerScript);
      } catch {
        if (!cancelled) setPhase("unavailable");
      }
    }

    begin();
    return () => {
      cancelled = true;
      providerScript?.remove();
      disposeWidget();
      delete window.tegoHCaptchaReady;
      resetWidget.current = () => {};
    };
  }, [scriptReady]);

  async function submit() {
    if (!token || !telegramRef.current || submitting.current) return;
    submitting.current = true;
    setPhase("sending");
    let failureCode = "network";
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge: challengeRef.current, token }),
      });
      const result = await response.json() as { proof?: string; code?: string };
      if (!response.ok || !result.proof) {
        failureCode = result.code || "captcha_rejected";
        throw new Error("verification rejected");
      }
      setToken("");
      setPhase("done");
      telegramRef.current.sendData(result.proof);
    } catch {
      setToken("");
      setPhase(failureCode === "invalid_ticket" ? "expired"
        : failureCode === "provider_unavailable" ? "unavailable"
        : failureCode === "network" ? "network" : "failed");
      resetWidget.current();
    } finally {
      submitting.current = false;
    }
  }

  const isError = ["invalid", "failed", "expired", "unavailable", "network"].includes(phase);

  return (
    <main className="verify-page">
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setPhase("invalid")}
      />
      <div className="brand" aria-label="tego">
        <span className="brand-mark" aria-hidden="true">t</span>
        <span>tego</span>
      </div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="description">{copy.description}</p>
      <div className="widget" ref={widgetRef} aria-label="CAPTCHA" />
      <button className="submit" type="button" disabled={!token || phase === "sending"} onClick={submit}>
        {copy.submit}
      </button>
      <p className="status" role="status" aria-live="polite" data-error={isError}>
        {phase === "solved" ? "" : copy[phase]}
      </p>
      <p className="foot">{copy.foot}</p>
    </main>
  );
}
