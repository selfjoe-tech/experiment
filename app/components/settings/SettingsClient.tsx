"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  updateProfileBasicsAction,
  updateAvatarAction,
  changePasswordAction,
  deleteAccountAction,
  type SettingsProfile,
  type SettingsFieldErrors,
} from "@/lib/actions/settings";

import { checkUsernameAvailability } from "@/lib/actions/auth";

type Props = {
  initialProfile: SettingsProfile;
};

type UsernameStatus = "idle" | "checking" | "available" | "taken";

export default function SettingsClient({ initialProfile }: Props) {
  const router = useRouter();

  // PROFILE (avatar, username, bio)
  const [username, setUsername] = useState(initialProfile.username ?? "");
  const [bio, setBio] = useState(initialProfile.bio ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initialProfile.avatarUrl
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [usernameStatus, setUsernameStatus] =
    useState<UsernameStatus>("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [profilePending, startProfileTransition] = useTransition();
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] =
    useState<SettingsFieldErrors>({});

  // AVATAR
  const [avatarPending, startAvatarTransition] = useTransition();
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  // PASSWORD
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, startPasswordTransition] = useTransition();
  const [passwordFieldErrors, setPasswordFieldErrors] =
    useState<SettingsFieldErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  // DELETE
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------- Username availability (debounced) ----------
  useEffect(() => {
    if (!username || username === (initialProfile.username ?? "")) {
      setUsernameStatus("idle");
      setUsernameError(null);
      return;
    }

    const lower = username.toLowerCase();
    const usernameRegex = /^[a-z0-9._]+$/;

    if (!usernameRegex.test(lower)) {
      setUsernameStatus("idle");
      setUsernameError(
        "Only lowercase letters, numbers, '.' and '_' are allowed."
      );
      return;
    }

    setUsernameStatus("checking");
    setUsernameError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(lower);
        if (res.available) {
          setUsernameStatus("available");
          setUsernameError(null);
        } else {
          setUsernameStatus("taken");
          setUsernameError("This username is already taken.");
        }
      } catch (err) {
        console.error("username check failed", err);
        setUsernameStatus("idle");
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [username, initialProfile.username]);

  // ---------- Handlers ----------

  const handleAvatarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleAvatarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAvatarMessage(null);

    if (!avatarFile) {
      setAvatarMessage("Please choose an image first.");
      return;
    }

    const fd = new FormData();
    fd.set("avatar", avatarFile);

    startAvatarTransition(async () => {
      const res = await updateAvatarAction(fd);
      if (!res.success) {
        setAvatarMessage(res.message ?? "Failed to update avatar.");
      } else {
        if (res.avatarUrl) setAvatarPreview(res.avatarUrl);
        setAvatarMessage("Avatar updated.");
        router.refresh();
      }
    });
  };

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileFieldErrors({});

    const fd = new FormData();
    fd.set("username", username);
    fd.set("bio", bio);

    startProfileTransition(async () => {
      const res = await updateProfileBasicsAction(fd);
      if (!res.success) {
        setProfileMessage(res.message ?? "Failed to update profile.");
        if (res.fieldErrors) setProfileFieldErrors(res.fieldErrors);
      } else {
        setProfileMessage("Profile updated.");
        router.refresh();
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordFieldErrors({});

    const fd = new FormData();
    fd.set("oldPassword", oldPassword);
    fd.set("newPassword", newPassword);
    fd.set("confirmPassword", confirmPassword);

    startPasswordTransition(async () => {
      const res = await changePasswordAction(fd);
      if (!res.success) {
        setPasswordMessage(res.message ?? "Failed to change password.");
        if (res.fieldErrors) setPasswordFieldErrors(res.fieldErrors);
      } else {
        setPasswordMessage("Password changed.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  const handleDeleteAccount = () => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteAccountAction();
      if (!res.success) {
        setDeleteError(res.message ?? "Failed to delete account.");
        return;
      }
      setDeleteOpen(false);
      router.push("/");
      router.refresh();
    });
  };

  // ---------- UI ----------

  return (
    <div className="space-y-10">
      {/* PROFILE SECTION */}
      <section className="rounded-2xl border border-white/10 bg-[#111] p-5 space-y-6">
        <h2 className="text-lg font-semibold">Profile</h2>

        {/* Avatar */}
        <form onSubmit={handleAvatarSubmit} className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-white/40">
                No avatar
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleAvatarInput}
                className="bg-black border-white/30 text-white text-sm file:text-xs file:bg-white file:text-black"
              />
              <Button
                type="submit"
                disabled={avatarPending}
                className="sm:w-28 rounded-full bg-white text-black hover:bg-white/90 text-sm font-semibold"
              >
                {avatarPending ? "Saving..." : "Save"}
              </Button>
            </div>
            {avatarMessage && (
              <p className="text-xs text-white/60">{avatarMessage}</p>
            )}
          </div>
        </form>

        {/* Username + bio */}
        <form onSubmit={handleProfileSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black border-white/30 text-white placeholder:text-white/40 h-10 pr-20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/60">
                {usernameStatus === "checking" && "Checking..."}
                {usernameStatus === "available" && "Available"}
                {usernameStatus === "taken" && (
                  <span className="text-red-400">Taken</span>
                )}
              </div>
            </div>
            {(usernameError || profileFieldErrors.username) && (
              <p className="text-xs text-red-400">
                {usernameError || profileFieldErrors.username}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell people a bit about yourself..."
              className="bg-black border-white/30 text-white placeholder:text-white/40"
            />
            {profileFieldErrors.bio && (
              <p className="text-xs text-red-400">
                {profileFieldErrors.bio}
              </p>
            )}
          </div>

          {profileMessage && (
            <p className="text-xs text-white/70">{profileMessage}</p>
          )}

          <Button
            type="submit"
            disabled={profilePending}
            className="rounded-full bg-white text-black hover:bg-white/90 font-semibold h-10 px-6 text-sm"
          >
            {profilePending ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </section>

      {/* PASSWORD SECTION */}
      <section className="rounded-2xl border border-white/10 bg-[#111] p-5 space-y-4">
        <h2 className="text-lg font-semibold">Change password</h2>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword">Current password</Label>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="bg-black border-white/30 text-white h-10"
            />
            {passwordFieldErrors.oldPassword && (
              <p className="text-xs text-red-400">
                {passwordFieldErrors.oldPassword}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-black border-white/30 text-white h-10"
            />
            {passwordFieldErrors.newPassword && (
              <p className="text-xs text-red-400">
                {passwordFieldErrors.newPassword}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-black border-white/30 text-white h-10"
            />
            {passwordFieldErrors.confirmPassword && (
              <p className="text-xs text-red-400">
                {passwordFieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {passwordMessage && (
            <p className="text-xs text-white/70">{passwordMessage}</p>
          )}

          <Button
            type="submit"
            disabled={passwordPending}
            className="rounded-full bg-white text-black hover:bg-white/90 font-semibold h-10 px-6 text-sm"
          >
            {passwordPending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </section>

      {/* DANGER ZONE */}
      <section className="rounded-2xl border border-red-500/40 bg-[#1a0204] p-5 space-y-3">
        <h2 className="text-lg font-semibold text-red-400">Danger zone</h2>
        <p className="text-xs text-red-200/80">
          Deleting your account will permanently remove your profile and every
          upload you&apos;ve created. This action cannot be undone.
        </p>
        <Button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="rounded-full border border-red-500 bg-transparent text-red-400 hover:bg-red-500/10 text-sm font-semibold h-10 px-6"
        >
          Delete my account
        </Button>
      </section>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-[#111] border border-red-500/40 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">
              Delete your account?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/80">
            This will permanently delete your account and all of your uploads.
            This cannot be undone.
          </p>
          {deleteError && (
            <p className="text-xs text-red-400 mt-2">{deleteError}</p>
          )}
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="rounded-full h-9 px-4 border-white/30 bg-transparent text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deletePending}
              className="rounded-full h-9 px-4 bg-red-500 text-black hover:bg-red-500/90 text-xs font-semibold"
            >
              {deletePending ? "Deleting..." : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
