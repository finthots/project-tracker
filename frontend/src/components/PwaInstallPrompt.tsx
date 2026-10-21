import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isInstalled() {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || standaloneNavigator.standalone === true;
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalled() || sessionStorage.getItem("pwa-install-dismissed") === "true") return;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setVisible(false);
  };

  const dismiss = () => {
    sessionStorage.setItem("pwa-install-dismissed", "true");
    setVisible(false);
  };

  if (!visible || !installPrompt) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300 sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-4 text-white shadow-2xl shadow-slate-950/40">
        <div className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-violet-500/25 blur-2xl" />
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex items-center gap-3 pr-8">
          <img
            src={`${import.meta.env.BASE_URL}pwa-192.png`}
            alt="ProjectTracker"
            className="h-14 w-14 rounded-2xl shadow-lg"
          />
          <div>
            <p className="font-semibold">Install ProjectTracker</p>
            <p className="mt-0.5 text-sm leading-5 text-slate-300">
              Add it to your device for quick, app-like access.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={install}
          className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-violet-500 active:scale-[0.99]"
        >
          <Download className="h-4 w-4" />
          Install app
        </button>
      </div>
    </div>
  );
}
