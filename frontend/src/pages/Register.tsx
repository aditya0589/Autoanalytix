import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../stores/useAuthStore";
import { useThemeStore } from "../stores/useThemeStore";
import { Lock, Mail, User, ArrowRight, Zap, Moon, Sun, ArrowLeft, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const steps = [
  { id: 1, label: "Create Account" },
  { id: 2, label: "Setup Workspace" },
  { id: 3, label: "Start Analyzing" },
];

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.auth.register({ email, password, full_name: fullName });
      await login(data.access_token, data.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ["", "bg-rose-500", "bg-amber-500", "bg-emerald-500"];
  const strengthLabels = ["", "Weak", "Fair", "Strong"];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#09090b] transition-colors duration-200">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 flex-col justify-between p-12">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 right-1/4 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-dot-grid opacity-20" />
        </div>

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-white">AutoAnalytix</span>
        </div>

        {/* Journey steps */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-3">
              Start your analytics
              <br />
              <span className="gradient-text">journey today.</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Get your workspace up and running in 60 seconds. No credit card required.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                  i === 0
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-white/[0.06] border-white/[0.12] text-slate-400"
                }`}>
                  {i === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.id}
                </div>
                <span className={`text-sm font-medium ${i === 0 ? "text-white" : "text-slate-400"}`}>
                  {step.label}
                </span>
                {i === 0 && <span className="ml-auto text-[10px] font-semibold badge-blue">Now</span>}
              </div>
            ))}
          </div>

          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 text-[12px] text-slate-300 leading-relaxed">
            🚀 Your free workspace includes unlimited datasets, AI chat, and shareable dashboards — with your own API key (BYOK model).
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-slate-500">
          © 2025 AutoAnalytix. All rights reserved.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">
        {/* Top controls */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="w-full max-w-[400px] animate-slide-up">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1.5">
              Create your account
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your workspace will be ready in seconds.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 text-sm bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-xl animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Work email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= passwordStrength ? strengthColors[passwordStrength] : "bg-slate-200 dark:bg-white/[0.08]"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-[11px] font-medium ${passwordStrength === 3 ? "text-emerald-600 dark:text-emerald-400" : passwordStrength === 2 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {strengthLabels[passwordStrength]}
                  </p>
                </div>
              )}
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-sm py-3 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating workspace…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-[13px] text-slate-500 dark:text-slate-400 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
