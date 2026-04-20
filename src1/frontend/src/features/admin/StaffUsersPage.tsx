import { useMemo, useState } from "react";
import { UserPlus, Edit, Trash2, UserCheck, UserX } from "lucide-react";

import { apiPost, apiPut, apiDelete } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAvatarDataUrl } from "@/lib/avatarImage";
import type { StaffUserSummary } from "@/types";

type EditModalState = {
  open: boolean;
  user: StaffUserSummary | null;
  displayName: string;
  pin: string;
  role: "cashier" | "admin";
  password: string;
  avatarImage: string;
  isActive: boolean;
};

type Props = {
  card: string;
  dark: boolean;
  users: StaffUserSummary[];
  reloadUsers: () => Promise<void>;
};

export function StaffUsersPage({ card, dark, users, reloadUsers }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"cashier" | "admin">("cashier");
  const [password, setPassword] = useState("");
  const [avatarImage, setAvatarImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<EditModalState>({
    open: false,
    user: null,
    displayName: "",
    pin: "",
    role: "cashier",
    password: "",
    avatarImage: "",
    isActive: true,
  });
  const [processing, setProcessing] = useState<string | null>(null);

  const inputClass = useMemo(
    () =>
      dark
        ? "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        : "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm",
    [dark],
  );

  const onAvatarUpload = (file: File | null) => {
    if (!file) return;
    setError(null);
    createAvatarDataUrl(file)
      .then((dataUrl) => setAvatarImage(dataUrl))
      .catch((err) => setError(err instanceof Error ? err.message : "Bild konnte nicht verarbeitet werden."));
  };

  const addUser = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiPost<StaffUserSummary, { display_name: string; username: string; pin: string; role: string; password: string; avatar_image: string }>(
        "/staff-users",
        {
          display_name: displayName,
          username,
          pin,
          role,
          password,
          avatar_image: avatarImage,
        },
      );
      setDisplayName("");
      setUsername("");
      setPin("");
      setPassword("");
      setAvatarImage("");
      setRole("cashier");
      await reloadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mitarbeiter konnte nicht erstellt werden");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user: StaffUserSummary) => {
    setEditModal({
      open: true,
      user,
      displayName: user.display_name,
      pin: "",
      role: user.role as "cashier" | "admin",
      password: "",
      avatarImage: user.avatar_image || "",
      isActive: true,
    });
  };

  const closeEditModal = () => {
    setEditModal({
      open: false,
      user: null,
      displayName: "",
      pin: "",
      role: "cashier",
      password: "",
      avatarImage: "",
      isActive: true,
    });
  };

  const saveEditModal = async () => {
    if (!editModal.user) return;
    setProcessing(`save-${editModal.user.id}`);
    setError(null);
    try {
      const updates: any = {};
      if (editModal.displayName !== editModal.user.display_name) {
        updates.display_name = editModal.displayName;
      }
      if (editModal.pin.trim()) {
        updates.pin = editModal.pin;
      }
      if (editModal.role !== editModal.user.role) {
        updates.role = editModal.role;
      }
      if (editModal.password.trim()) {
        updates.password = editModal.password;
      }
      if (editModal.avatarImage !== editModal.user.avatar_image) {
        updates.avatar_image = editModal.avatarImage;
      }
      
      await apiPut<StaffUserSummary, any>(`/staff-users/${editModal.user.id}`, updates);
      await reloadUsers();
      closeEditModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Aktualisieren");
    } finally {
      setProcessing(null);
    }
  };

  const confirmDeactivate = async (user: StaffUserSummary) => {
    if (!confirm(`Mitarbeiter "${user.display_name}" wirklich deaktivieren?\nDer Benutzer kann sich danach nicht mehr einloggen.`)) {
      return;
    }
    setProcessing(`delete-${user.id}`);
    try {
      await apiDelete(`/staff-users/${user.id}`);
      await reloadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Deaktivieren");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Mitarbeiter verwalten</h2>
          <p className={dark ? "text-sm text-slate-400" : "text-sm text-slate-600"}>PIN-Profile, Rollen und optionale Bilder für den Login-Screen.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input className={inputClass} placeholder="Anzeigename" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className={inputClass} placeholder="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} />
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as "cashier" | "admin")}>
              <option value="cashier">Kasse</option>
              <option value="admin">Admin</option>
            </select>
            <input
              className={`${inputClass} text-center tracking-[0.25em]`}
              inputMode="numeric"
              placeholder="PIN (4 Ziffern)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              maxLength={4}
            />
            <input
              className={inputClass}
              type="password"
              placeholder="Admin Passwort (mind. 12)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={role !== "admin"}
            />
            <input className={inputClass} type="file" accept="image/*" onChange={(e) => onAvatarUpload(e.target.files?.[0] ?? null)} />
          </div>

          {avatarImage && <img src={avatarImage} alt="Preview" className="mt-3 h-20 w-20 rounded-full object-cover" />}
          {error && <div className={dark ? "mt-3 text-sm text-rose-300" : "mt-3 text-sm text-rose-600"}>{error}</div>}

          <Button
            className="mt-4"
            onClick={addUser}
            disabled={saving || displayName.trim().length < 2 || username.trim().length < 3 || pin.trim().length !== 4 || (role === "admin" && password.trim().length < 12)}
          >
            <UserPlus size={16} className="mr-2" />
            {saving ? "Speichern..." : "Mitarbeiter anlegen"}
          </Button>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h3 className="text-base font-semibold">Aktive Mitarbeiter</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className={dark ? "border-b border-slate-800 text-slate-400" : "border-b border-slate-200 text-slate-500"}>
                  <th className="py-2">Profil</th>
                  <th>Name</th>
                  <th>Benutzername</th>
                  <th>Rolle</th>
                  <th className="text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={dark ? "border-b border-slate-800 last:border-0" : "border-b border-slate-200 last:border-0"}>
                    <td className="py-2">
                      {user.avatar_image ? (
                        <img src={user.avatar_image} alt={user.display_name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500 text-xs font-semibold">{user.display_name[0]}</div>
                      )}
                    </td>
                    <td>{user.display_name}</td>
                    <td>{user.username}</td>
                    <td>{user.role === "admin" ? "Admin" : "Kasse"}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="rounded-lg p-1 hover:bg-slate-800"
                          title="Bearbeiten"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeactivate(user)}
                          className="rounded-lg p-1 text-rose-500 hover:bg-rose-950"
                          title="Deaktivieren"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editModal.open && editModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 ${card}`}>
            <h3 className="text-lg font-semibold">Mitarbeiter bearbeiten</h3>
            <p className={`mt-1 text-sm ${dark ? "text-slate-400" : "text-slate-600"}`}>
              {editModal.user.display_name} ({editModal.user.username})
            </p>
            
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Anzeigename</label>
                <input
                  className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                    dark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                  }`}
                  value={editModal.displayName}
                  onChange={(e) => setEditModal({...editModal, displayName: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium">Neue PIN (leer lassen, um beizubehalten)</label>
                <input
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-center tracking-[0.25em] ${
                    dark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                  }`}
                  inputMode="numeric"
                  placeholder="****"
                  value={editModal.pin}
                  onChange={(e) => setEditModal({...editModal, pin: e.target.value.replace(/[^0-9]/g, "").slice(0, 4)})}
                  maxLength={4}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium">Rolle</label>
                <select
                  className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                    dark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                  }`}
                  value={editModal.role}
                  onChange={(e) => setEditModal({...editModal, role: e.target.value as "cashier" | "admin"})}
                >
                  <option value="cashier">Kasse</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              {editModal.role === "admin" && (
                <div>
                  <label className="block text-sm font-medium">Neues Passwort (mind. 12 Zeichen, leer lassen, um beizubehalten)</label>
                  <input
                    type="password"
                    className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                      dark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                    }`}
                    placeholder="Neues Passwort"
                    value={editModal.password}
                    onChange={(e) => setEditModal({...editModal, password: e.target.value})}
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium">Profilbild</label>
                <input
                  type="file"
                  accept="image/*"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                    dark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                  }`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError(null);
                    createAvatarDataUrl(file)
                      .then((dataUrl) => setEditModal({ ...editModal, avatarImage: dataUrl }))
                      .catch((err) => setError(err instanceof Error ? err.message : "Bild konnte nicht verarbeitet werden."));
                  }}
                />
                {editModal.avatarImage && (
                  <img src={editModal.avatarImage} alt="Preview" className="mt-2 h-16 w-16 rounded-full object-cover" />
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={closeEditModal} disabled={!!processing}>
                Abbrechen
              </Button>
              <Button
                onClick={saveEditModal}
                disabled={
                  !!processing ||
                  (editModal.role === "admin" && editModal.password.trim() && editModal.password.trim().length < 12)
                }
              >
                {processing === `save-${editModal.user.id}` ? "Speichern..." : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
