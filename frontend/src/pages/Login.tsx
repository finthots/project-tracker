import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { setupNeeded, setupAdmin } from "@/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Zap } from "lucide-react";

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    setupNeeded().then((r) => setIsSetup(r.data.setup_needed));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSetup) {
        await setupAdmin(username, password);
      } else {
        await login(username, password);
      }
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen size={28} className="text-blue-400" />
            <Zap size={28} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">ProjectTracker</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isSetup ? "First run — create your admin account" : "Finthots & Sunyukth Teams"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 space-y-4"
        >
          {isSetup && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !username || !password}
          >
            {loading ? "Please wait…" : isSetup ? "Create Admin Account" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
