import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Moon, ShieldCheck, Smartphone, Sun } from "lucide-react";

import { apiGet, apiPost, setAuthToken } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StaffUserSummary } from "@/types";

type LoginResponse = {
  access_token: string;
  user_id: string;
  username: string;
  display_name: string;
  role: string;
};

type BootstrapStatus = { setup_required: boolean };

type Screen = "setup" | "landing" | "cashier-users" | "cashier-pin" | "admin-users" | "admin-password";

export function LoginPage({
  dark,
  onToggleDark,
  onLoggedIn,
}: {
  dark: boolean;
  onToggleDark: () => void;
  onLoggedIn: (me: { username: string; displayName: string; role: string }) => void;
}) {
  const [screen, setScreen] = useState<Screen>("landing");
  const [cashiers, setCashiers] = useState<StaffUserSummary[]>([]);
  const [admins, setAdmins] = useState<StaffUserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<StaffUserSummary | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [setupUsername, setSetupUsername] = useState("admin");
  const [setupDisplayName, setSetupDisplayName] = useState("Admin");
  const [setupPin, setSetupPin] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupAvatar, setSetupAvatar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card = useMemo(() => (dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"), [dark]);
  const tile = (active = false) =>
    [
      "rounded-2xl border p-6 text-left transition",
      dark ? "border-slate-700 bg-slate-950 text-slate-100 hover:border-emerald-500/50" : "border-slate-300 bg-white text-slate-900 hover:border-emerald-400",
      active && (dark ? "border-emerald-400/70 bg-emerald-500/10" : "border-emerald-500 bg-emerald-50"),
    ]
      .filter(Boolean)
      .join(" ");
  const inputClass = dark
    ? "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
    : "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900";

  const loadUsers = async () => {
    const cashierRows = await apiGet<StaffUserSummary[]>("/staff-users/cashier-list");
    setCashiers(cashierRows.filter((u: StaffUserSummary) => u.role === "cashier"));
  };

  useEffect(() => {
    const load = async () => {
      try {
        const status = await apiGet<BootstrapStatus>("/auth/bootstrap-status");
        if (status.setup_required) {
          setScreen("setup");
          return;
        }
        await loadUsers();
      } catch {
        setError("Initialisierung fehlgeschlagen");
      }
    };
    load();
  }, []);

  async function submitSetup() {
    if (setupPassword.length < 12 || setupPin.length !== 4) return;
    setLoading(true);
    setError(null);
    try {
      await apiPost<StaffUserSummary, { username: string; display_name: string; pin: string; password: string; avatar_image: string }>(
        "/auth/bootstrap-admin",
        {
          username: setupUsername,
          display_name: setupDisplayName,
          pin: setupPin,
          password: setupPassword,
          avatar_image: setupAvatar,
        },
      );
      await loadUsers();
      setScreen("landing");
      setSetupPin("");
      setSetupPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admin-Setup fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  async function submitCashier() {
    if (!selectedUser || pin.length !== 4) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<LoginResponse, { user_id: string; pin: string }>("/auth/cashier-login", { user_id: selectedUser.id, pin });
      setAuthToken(res.access_token);
      onLoggedIn({ username: res.username, displayName: res.display_name, role: res.role });
    } catch (e) {
      setAuthToken(null);
      setError(e instanceof Error ? e.message : "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  async function submitAdmin() {
    if (adminUsername.trim().length < 3 || password.length < 12) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<LoginResponse, { username: string; password: string }>("/auth/admin-login", {
        username: adminUsername.trim().toLowerCase(),
        password,
      });
      setAuthToken(res.access_token);
      onLoggedIn({ username: res.username, displayName: res.display_name, role: res.role });
    } catch (e) {
      setAuthToken(null);
      setError(e instanceof Error ? e.message : "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  const keypadInput = (value: string) => {
    if (value === "del") return setPin((prev) => prev.slice(0, -1));
    if (value === "clr") return setPin("");
    setPin((prev) => (prev.length < 4 ? `${prev}${value}` : prev));
  };

  const avatar = (user: StaffUserSummary) => {
    if (user.avatar_image) return <img src={user.avatar_image} alt={user.display_name} className="h-16 w-16 rounded-full object-cover" />;
    return <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-600 text-xl font-semibold text-white">{user.display_name[0]}</div>;
  };

  const onSetupImage = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSetupAvatar(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  return (
    <div className={`min-h-screen p-4 sm:p-8 ${dark ? "bg-slate-950 text-slate-100" : "bg-amber-50 text-slate-900"}`}>
      <div className="mx-auto mb-3 flex w-full max-w-5xl justify-end">
        <Button variant="outline" onClick={onToggleDark} aria-label="Farbschema wechseln">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center">
        <Card className={`${card} w-full shadow-2xl`}>
          <CardContent className="p-6 sm:p-8">
            <h1 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? "text-slate-100" : "text-slate-900"}`}>Buchhandlung Login</h1>

            {screen === "setup" && (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <input className={inputClass} placeholder="Benutzername" value={setupUsername} onChange={(e) => setSetupUsername(e.target.value)} />
                <input className={inputClass} placeholder="Anzeigename" value={setupDisplayName} onChange={(e) => setSetupDisplayName(e.target.value)} />
                <input className={inputClass} inputMode="numeric" maxLength={4} placeholder="PIN (4-stellig)" value={setupPin} onChange={(e) => setSetupPin(e.target.value.replace(/[^0-9]/g, ""))} />
                <input className={inputClass} type="password" placeholder="Admin-Passwort (mind. 12 Zeichen)" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} />
                <input className={inputClass} type="file" accept="image/*" onChange={(e) => onSetupImage(e.target.files?.[0] ?? null)} />
                <Button className="h-12" disabled={loading || setupPassword.length < 12 || setupPin.length !== 4} onClick={submitSetup}>
                  {loading ? "Speichern..." : "Ersten Admin anlegen"}
                </Button>
              </div>
            )}

            {screen === "landing" && (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <button className={`${tile()} min-h-40`} onClick={() => setScreen("cashier-users")}>
                  <div className="mb-3 inline-flex rounded-xl bg-emerald-500/15 p-2"><Smartphone /></div>
                  <div className="text-2xl font-semibold">Kassen-Login</div>
                  <p className={dark ? "mt-2 text-slate-300" : "mt-2 text-slate-600"}>Mitarbeiter wählen und 4-stellige PIN eingeben.</p>
                </button>
                <button className={`${tile()} min-h-40`} onClick={() => setScreen("admin-users")}>
                  <div className="mb-3 inline-flex rounded-xl bg-blue-500/15 p-2"><ShieldCheck /></div>
                  <div className="text-2xl font-semibold">Admin-Login</div>
                  <p className={dark ? "mt-2 text-slate-300" : "mt-2 text-slate-600"}>Benutzername und Admin-Passwort (mind. 12 Zeichen) eingeben.</p>
                </button>
              </div>
            )}

            {screen === "cashier-users" && (
              <div className="mt-6">
                <button className="mb-4 inline-flex items-center gap-2 text-sm" onClick={() => setScreen("landing")}>
                  <ChevronLeft size={16} /> Zurück
                </button>
                <h2 className="mb-4 text-xl font-semibold">Mitarbeiter wählen</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {cashiers.map((user) => (
                    <button
                      key={user.id}
                      className={tile(selectedUser?.id === user.id)}
                      onClick={() => {
                        setSelectedUser(user);
                        setPin("");
                        setError(null);
                        setScreen("cashier-pin");
                      }}
                    >
                      <div className="mb-3">{avatar(user)}</div>
                      <div className="line-clamp-1 font-medium">{user.display_name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {screen === "admin-users" && (
              <div className="mt-6 max-w-xl space-y-4">
                <button className="inline-flex items-center gap-2 text-sm" onClick={() => setScreen("landing")}>
                  <ChevronLeft size={16} /> Zurück
                </button>
                <h2 className="text-xl font-semibold">Admin anmelden</h2>
                <input className={inputClass} placeholder="Benutzername" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} />
                <input className={inputClass} type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button className="h-12" disabled={loading || adminUsername.trim().length < 3 || password.length < 12} onClick={submitAdmin}>
                  {loading ? "Prüfe Zugang..." : "Als Admin anmelden"}
                </Button>
              </div>
            )}

            {screen === "cashier-pin" && selectedUser && (
              <div className="mt-6">
                <button className="mb-4 inline-flex items-center gap-2 text-sm" onClick={() => setScreen("cashier-users")}>
                  <ChevronLeft size={16} /> Nutzer wechseln
                </button>
                <div className="mb-4 flex items-center gap-3">
                  {avatar(selectedUser)}
                  <div>
                    <div className="font-semibold">{selectedUser.display_name}</div>
                    <div className={dark ? "text-sm text-slate-400" : "text-sm text-slate-600"}>PIN eingeben</div>
                  </div>
                </div>
                <div className="mb-4 rounded-2xl border p-4 text-center text-3xl tracking-[0.45em]">{pin.padEnd(4, "-")}</div>
                <div className="grid grid-cols-3 gap-3">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "del"].map((k) => (
                    <button key={k} className={tile()} onClick={() => keypadInput(k)}>
                      <div className="text-center text-xl font-semibold uppercase">{k === "del" ? "←" : k}</div>
                    </button>
                  ))}
                </div>
                <Button className="mt-4 h-12 w-full text-lg" disabled={loading || pin.length !== 4} onClick={submitCashier}>
                  {loading ? "Anmeldung..." : "Kasse öffnen"}
                </Button>
              </div>
            )}

            {screen === "admin-password" && selectedUser && (
              <div className="mt-6 max-w-md">
                <button className="mb-4 inline-flex items-center gap-2 text-sm" onClick={() => setScreen("admin-users")}>
                  <ChevronLeft size={16} /> Nutzer wechseln
                </button>
                <div className="mb-4 flex items-center gap-3">
                  {avatar(selectedUser)}
                  <div className="font-semibold">{selectedUser.display_name}</div>
                </div>
                <input
                  type="password"
                  className={dark ? "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" : "w-full rounded-xl border border-slate-300 px-4 py-3"}
                  placeholder="Admin-Passwort (mind. 12 Zeichen)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button className="mt-4 h-12 w-full text-base" disabled={loading || password.length < 12} onClick={submitAdmin}>
                  {loading ? "Anmeldung..." : "Als Admin anmelden"}
                </Button>
              </div>
            )}

            {error && <div className={dark ? "mt-4 text-sm text-rose-300" : "mt-4 text-sm text-rose-700"}>{error}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
