import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiPost, setAuthToken } from "@/api/client";

type LoginResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  display_name: string;
  role: string;
};

export function LoginPage({
  dark,
  onLoggedIn,
}: {
  dark: boolean;
  onLoggedIn: (me: { username: string; displayName: string; role: string }) => void;
}) {
  const [username, setUsername] = useState("admin");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card = useMemo(() => (dark ? "bg-gray-900 border-gray-800" : "bg-white"), [dark]);
  const input = useMemo(
    () =>
      dark
        ? "w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100"
        : "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm",
    [dark],
  );

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<LoginResponse, { username: string; pin: string }>("/auth/login", {
        username,
        pin,
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

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h1 className="text-xl font-semibold">Mitarbeiter-Login</h1>
          <p className={dark ? "mt-2 text-sm text-gray-400" : "mt-2 text-sm text-gray-600"}>
            Für Schreibaktionen (Kasse, Wareneingang, Stammdaten) anmelden.
          </p>

          <div className="mt-6 space-y-3">
            <div>
              <label className={dark ? "mb-1 block text-xs text-gray-400" : "mb-1 block text-xs text-gray-600"}>
                Benutzername
              </label>
              <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className={dark ? "mb-1 block text-xs text-gray-400" : "mb-1 block text-xs text-gray-600"}>
                PIN
              </label>
              <input
                className={input}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>
          </div>

          {error && (
            <div className={dark ? "mt-4 text-sm text-red-300" : "mt-4 text-sm text-red-600"}>{error}</div>
          )}

          <div className="mt-6">
            <Button onClick={submit} disabled={loading || pin.trim().length < 4} className="w-full">
              {loading ? "Anmelden..." : "Anmelden"}
            </Button>
          </div>

          <div className={dark ? "mt-4 text-xs text-gray-500" : "mt-4 text-xs text-gray-500"}>
            Default-Login: Benutzer `admin`, PIN `1234`.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
