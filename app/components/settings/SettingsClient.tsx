"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

import { ChevronDown, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";

import VerifiedLinksEditor from "@/app/settings/VerifiedLinksEditor";

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

function Section({
  title,
  tone = "normal",
  defaultOpen = false,
  children,
}: {
  title: string;
  tone?: "normal" | "danger";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const shell =
    tone === "danger"
      ? "rounded-2xl border border-red-500/40 bg-[#1a0204] p-5"
      : "rounded-2xl border border-white/10 bg-[#111] p-5";

  const titleCls =
    tone === "danger"
      ? "text-lg font-semibold text-red-400"
      : "text-lg font-semibold";

  return (
    <section className={shell}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
        aria-expanded={open}
      >
        <h2 className={titleCls}>{title}</h2>
        <ChevronDown
          className={`h-5 w-5 text-white/70 transition-transform ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      <div className={open ? "mt-5 block" : "mt-5 hidden"}>{children}</div>
    </section>
  );
}

export default function SettingsClient({ initialProfile }: Props) {
  const router = useRouter();

  // PROFILE (username, bio, avatar)
  const [username, setUsername] = useState(initialProfile.username ?? "");
  const [bio, setBio] = useState(initialProfile.bio ?? "");
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    (initialProfile as any).avatarUrl ?? null
  );

  // Dice file upload state
  const [avatarFiles, setAvatarFiles] = useState<File[]>([]);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [profilePending, startProfileTransition] = useTransition();
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] =
    useState<SettingsFieldErrors>({});

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
      setUsernameError("Only lowercase letters, numbers, '.' and '_' are allowed.");
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

  // ---------- Avatar preview from selected file ----------
  useEffect(() => {
    if (!avatarFiles?.[0]) return;

    const url = URL.createObjectURL(avatarFiles[0]);
    setAvatarPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [avatarFiles]);

  // ---------- Dice UI upload handlers ----------
  const onAvatarUpload = useCallback(
    async (
      files: File[],
      {
        onProgress,
        onSuccess,
        onError,
      }: {
        onProgress: (file: File, progress: number) => void;
        onSuccess: (file: File) => void;
        onError: (file: File, error: Error) => void;
      }
    ) => {
      setAvatarMessage(null);

      // only keep the first file for avatar
      const file = files?.[0];
      if (!file) return;

      try {
        // fake progress to make Dice UI feel alive
        for (const p of [10, 25, 45, 65, 80, 92]) {
          await new Promise((r) => setTimeout(r, 80));
          onProgress(file, p);
        }

        const fd = new FormData();
        fd.set("avatar", file);

        const res = await updateAvatarAction(fd);

        if (!res?.success) {
          const msg = res?.message ?? "Failed to update avatar.";
          setAvatarMessage(msg);
          onError(file, new Error(msg));
          return;
        }

        onProgress(file, 100);
        onSuccess(file);

        if (res.avatarUrl) setAvatarPreview(res.avatarUrl);
        setAvatarMessage("Avatar updated.");
        setAvatarFiles([]); // clear selection tiles
        router.refresh();
      } catch (e: any) {
        const msg = e?.message ?? "Failed to update avatar.";
        setAvatarMessage(msg);
        onError(file, e instanceof Error ? e : new Error(msg));
      }
    },
    [router]
  );

  const onAvatarReject = useCallback((file: File, message: string) => {
    toast(message, {
      description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
    });
  }, []);

  // ---------- Handlers ----------
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

  // verified/links (keep TS happy even if SettingsProfile type hasn’t been updated yet)
  const verified = !!(initialProfile as any).verified;
  const initialLinks = ((initialProfile as any).links ?? {}) as any;

  return (
    <div className="space-y-6">
      {/* PROFILE SECTION */}
      <Section title="Profile" defaultOpen>
        {/* Avatar */}
        <div className="flex items-center flex-col gap-4">
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

          <div className="w-full">
            <FileUpload
              value={avatarFiles}
              onValueChange={setAvatarFiles}
              maxFiles={1}
              maxSize={5 * 1024 * 1024}
              className="w-full"
              onUpload={onAvatarUpload}
              onFileReject={onAvatarReject}
              accept="image/*"
            >
              <FileUploadDropzone>
                <div className="flex flex-col items-center gap-1 text-center">
                  <div className="flex items-center justify-center rounded-full border border-white/20 p-2.5">
                    <Upload className="size-6 text-white/70" />
                  </div>
                  <p className="font-medium text-sm">Drag & drop your avatar here</p>
                  <p className="text-white/50 text-xs">
                    Or click to browse (max 1 file, up to 5MB)
                  </p>
                </div>

                <FileUploadTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2 w-fit border-white/20 bg-transparent text-white hover:bg-white/10">
                    Browse image
                  </Button>
                </FileUploadTrigger>
              </FileUploadDropzone>

              <FileUploadList orientation="horizontal">
                {avatarFiles.map((file, index) => (
                  <FileUploadItem key={index} value={file} className="p-0">
                    <FileUploadItemPreview className="size-20 [&>svg]:size-12">
                      <FileUploadItemProgress variant="circular" size={40} />
                    </FileUploadItemPreview>
                    <FileUploadItemMetadata className="sr-only" />
                    <FileUploadItemDelete asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute -top-1 -right-1 size-5 rounded-full"
                      >
                        <X className="size-3" />
                      </Button>
                    </FileUploadItemDelete>
                  </FileUploadItem>
                ))}
              </FileUploadList>
            </FileUpload>

            {avatarMessage && (
              <p className="mt-2 text-xs text-white/60">{avatarMessage}</p>
            )}
          </div>
        </div>

        {/* Username + bio */}
        <form onSubmit={handleProfileSubmit} className="space-y-4 pt-6">
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
                {usernameStatus === "taken" && <span className="text-red-400">Taken</span>}
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
              <p className="text-xs text-red-400">{profileFieldErrors.bio}</p>
            )}
          </div>

          {profileMessage && <p className="text-xs text-white/70">{profileMessage}</p>}

          <Button
            type="submit"
            disabled={profilePending}
            className="rounded-full bg-white text-black hover:bg-white/90 font-semibold h-10 px-6 text-sm"
          >
            {profilePending ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </Section>

      {/* CREATOR LINKS SECTION */}
      <Section title="Creator links" defaultOpen={false}>
        <VerifiedLinksEditor
          verified={verified}
          initialLinks={initialLinks}
        />
        
      </Section>

      {/* PASSWORD SECTION */}
      <Section title="Change password" defaultOpen={false}>
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
              <p className="text-xs text-red-400">{passwordFieldErrors.oldPassword}</p>
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
              <p className="text-xs text-red-400">{passwordFieldErrors.newPassword}</p>
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
              <p className="text-xs text-red-400">{passwordFieldErrors.confirmPassword}</p>
            )}
          </div>

          {passwordMessage && <p className="text-xs text-white/70">{passwordMessage}</p>}

          <Button
            type="submit"
            disabled={passwordPending}
            className="rounded-full bg-white text-black hover:bg-white/90 font-semibold h-10 px-6 text-sm"
          >
            {passwordPending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Section>

      {/* DANGER ZONE */}
      <Section title="Danger zone" tone="danger" defaultOpen={false}>
        <p className="text-xs text-red-200/80">
          Deleting your account will permanently remove your profile and every upload you&apos;ve created.
          This action cannot be undone.
        </p>

        <Button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="mt-3 rounded-full border border-red-500 bg-transparent text-red-400 hover:bg-red-500/10 text-sm font-semibold h-10 px-6"
        >
          Delete my account
        </Button>
      </Section>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-[#111] border border-red-500/40 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete your account?</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-white/80">
            This will permanently delete your account and all of your uploads. This cannot be undone.
          </p>

          {deleteError && <p className="text-xs text-red-400 mt-2">{deleteError}</p>}

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



// "use client";

// import { useEffect, useState, useTransition } from "react";
// import Image from "next/image";
// import { useRouter } from "next/navigation";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { Button } from "@/components/ui/button";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import {
//   updateProfileBasicsAction,
//   updateAvatarAction,
//   changePasswordAction,
//   deleteAccountAction,
//   type SettingsProfile,
//   type SettingsFieldErrors,
// } from "@/lib/actions/settings";

// import { checkUsernameAvailability } from "@/lib/actions/auth";

// type Props = {
//   initialProfile: SettingsProfile;
// };

// type UsernameStatus = "idle" | "checking" | "available" | "taken";

// export default function SettingsClient({ initialProfile }: Props) {
//   const router = useRouter();

//   // PROFILE (avatar, username, bio)
//   const [username, setUsername] = useState(initialProfile.username ?? "");
//   const [bio, setBio] = useState(initialProfile.bio ?? "");
//   const [avatarPreview, setAvatarPreview] = useState<string | null>(
//     initialProfile.avatarUrl
//   );
//   const [avatarFile, setAvatarFile] = useState<File | null>(null);

//   const [usernameStatus, setUsernameStatus] =
//     useState<UsernameStatus>("idle");
//   const [usernameError, setUsernameError] = useState<string | null>(null);

//   const [profilePending, startProfileTransition] = useTransition();
//   const [profileMessage, setProfileMessage] = useState<string | null>(null);
//   const [profileFieldErrors, setProfileFieldErrors] =
//     useState<SettingsFieldErrors>({});

//   // AVATAR
//   const [avatarPending, startAvatarTransition] = useTransition();
//   const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

//   // PASSWORD
//   const [oldPassword, setOldPassword] = useState("");
//   const [newPassword, setNewPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");
//   const [passwordPending, startPasswordTransition] = useTransition();
//   const [passwordFieldErrors, setPasswordFieldErrors] =
//     useState<SettingsFieldErrors>({});
//   const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

//   // DELETE
//   const [deleteOpen, setDeleteOpen] = useState(false);
//   const [deletePending, startDeleteTransition] = useTransition();
//   const [deleteError, setDeleteError] = useState<string | null>(null);

//   // ---------- Username availability (debounced) ----------
//   useEffect(() => {
//     if (!username || username === (initialProfile.username ?? "")) {
//       setUsernameStatus("idle");
//       setUsernameError(null);
//       return;
//     }

//     const lower = username.toLowerCase();
//     const usernameRegex = /^[a-z0-9._]+$/;

//     if (!usernameRegex.test(lower)) {
//       setUsernameStatus("idle");
//       setUsernameError(
//         "Only lowercase letters, numbers, '.' and '_' are allowed."
//       );
//       return;
//     }

//     setUsernameStatus("checking");
//     setUsernameError(null);

//     const timeoutId = setTimeout(async () => {
//       try {
//         const res = await checkUsernameAvailability(lower);
//         if (res.available) {
//           setUsernameStatus("available");
//           setUsernameError(null);
//         } else {
//           setUsernameStatus("taken");
//           setUsernameError("This username is already taken.");
//         }
//       } catch (err) {
//         console.error("username check failed", err);
//         setUsernameStatus("idle");
//       }
//     }, 400);

//     return () => clearTimeout(timeoutId);
//   }, [username, initialProfile.username]);

//   // ---------- Handlers ----------

//   const handleAvatarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     setAvatarFile(file);
//     const url = URL.createObjectURL(file);
//     setAvatarPreview(url);
//   };

//   const handleAvatarSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     setAvatarMessage(null);

//     if (!avatarFile) {
//       setAvatarMessage("Please choose an image first.");
//       return;
//     }

//     const fd = new FormData();
//     fd.set("avatar", avatarFile);

//     startAvatarTransition(async () => {
//       const res = await updateAvatarAction(fd);
//       if (!res.success) {
//         setAvatarMessage(res.message ?? "Failed to update avatar.");
//       } else {
//         if (res.avatarUrl) setAvatarPreview(res.avatarUrl);
//         setAvatarMessage("Avatar updated.");
//         router.refresh();
//       }
//     });
//   };

//   const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setProfileMessage(null);
//     setProfileFieldErrors({});

//     const fd = new FormData();
//     fd.set("username", username);
//     fd.set("bio", bio);

//     startProfileTransition(async () => {
//       const res = await updateProfileBasicsAction(fd);
//       if (!res.success) {
//         setProfileMessage(res.message ?? "Failed to update profile.");
//         if (res.fieldErrors) setProfileFieldErrors(res.fieldErrors);
//       } else {
//         setProfileMessage("Profile updated.");
//         router.refresh();
//       }
//     });
//   };

//   const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setPasswordMessage(null);
//     setPasswordFieldErrors({});

//     const fd = new FormData();
//     fd.set("oldPassword", oldPassword);
//     fd.set("newPassword", newPassword);
//     fd.set("confirmPassword", confirmPassword);

//     startPasswordTransition(async () => {
//       const res = await changePasswordAction(fd);
//       if (!res.success) {
//         setPasswordMessage(res.message ?? "Failed to change password.");
//         if (res.fieldErrors) setPasswordFieldErrors(res.fieldErrors);
//       } else {
//         setPasswordMessage("Password changed.");
//         setOldPassword("");
//         setNewPassword("");
//         setConfirmPassword("");
//       }
//     });
//   };

//   const handleDeleteAccount = () => {
//     setDeleteError(null);
//     startDeleteTransition(async () => {
//       const res = await deleteAccountAction();
//       if (!res.success) {
//         setDeleteError(res.message ?? "Failed to delete account.");
//         return;
//       }
//       setDeleteOpen(false);
//       router.push("/");
//       router.refresh();
//     });
//   };

//   // ---------- UI ----------

//   return (
//     <div className="space-y-10">
//       {/* PROFILE SECTION */}
//       <section className="rounded-2xl border border-white/10 bg-[#111] p-5 space-y-6">
//         <h2 className="text-lg font-semibold">Profile</h2>

//         {/* Avatar */}
//         <form onSubmit={handleAvatarSubmit} className="flex items-center gap-4">
//           <div className="h-16 w-16 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
//             {avatarPreview ? (
//               // eslint-disable-next-line @next/next/no-img-element
//               <img
//                 src={avatarPreview}
//                 alt="Avatar preview"
//                 className="h-full w-full object-cover"
//               />
//             ) : (
//               <div className="h-full w-full flex items-center justify-center text-xs text-white/40">
//                 No avatar
//               </div>
//             )}
//           </div>
//           <div className="flex-1 space-y-2">
//             <div className="flex flex-col sm:flex-row sm:items-center gap-2">
//               <Input
//                 type="file"
//                 accept="image/*"
//                 onChange={handleAvatarInput}
//                 className="bg-black border-white/30 text-white text-sm file:text-xs file:bg-white file:text-black"
//               />
//               <Button
//                 type="submit"
//                 disabled={avatarPending}
//                 className="sm:w-28 rounded-full bg-white text-black hover:bg-white/90 text-sm font-semibold"
//               >
//                 {avatarPending ? "Saving..." : "Save"}
//               </Button>
//             </div>
//             {avatarMessage && (
//               <p className="text-xs text-white/60">{avatarMessage}</p>
//             )}
//           </div>
//         </form>

//         {/* Username + bio */}
//         <form onSubmit={handleProfileSubmit} className="space-y-4 pt-2">
//           <div className="space-y-2">
//             <Label htmlFor="username">Username</Label>
//             <div className="relative">
//               <Input
//                 id="username"
//                 value={username}
//                 onChange={(e) => setUsername(e.target.value)}
//                 className="bg-black border-white/30 text-white placeholder:text-white/40 h-10 pr-20"
//               />
//               <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/60">
//                 {usernameStatus === "checking" && "Checking..."}
//                 {usernameStatus === "available" && "Available"}
//                 {usernameStatus === "taken" && (
//                   <span className="text-red-400">Taken</span>
//                 )}
//               </div>
//             </div>
//             {(usernameError || profileFieldErrors.username) && (
//               <p className="text-xs text-red-400">
//                 {usernameError || profileFieldErrors.username}
//               </p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="bio">Bio</Label>
//             <Textarea
//               id="bio"
//               value={bio}
//               onChange={(e) => setBio(e.target.value)}
//               rows={3}
//               placeholder="Tell people a bit about yourself..."
//               className="bg-black border-white/30 text-white placeholder:text-white/40"
//             />
//             {profileFieldErrors.bio && (
//               <p className="text-xs text-red-400">
//                 {profileFieldErrors.bio}
//               </p>
//             )}
//           </div>

//           {profileMessage && (
//             <p className="text-xs text-white/70">{profileMessage}</p>
//           )}

//           <Button
//             type="submit"
//             disabled={profilePending}
//             className="rounded-full bg-white text-black hover:bg-white/90 font-semibold h-10 px-6 text-sm"
//           >
//             {profilePending ? "Saving..." : "Save changes"}
//           </Button>
//         </form>
//       </section>

//       {/* PASSWORD SECTION */}
//       <section className="rounded-2xl border border-white/10 bg-[#111] p-5 space-y-4">
//         <h2 className="text-lg font-semibold">Change password</h2>

//         <form onSubmit={handlePasswordSubmit} className="space-y-4">
//           <div className="space-y-2">
//             <Label htmlFor="oldPassword">Current password</Label>
//             <Input
//               id="oldPassword"
//               type="password"
//               value={oldPassword}
//               onChange={(e) => setOldPassword(e.target.value)}
//               className="bg-black border-white/30 text-white h-10"
//             />
//             {passwordFieldErrors.oldPassword && (
//               <p className="text-xs text-red-400">
//                 {passwordFieldErrors.oldPassword}
//               </p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="newPassword">New password</Label>
//             <Input
//               id="newPassword"
//               type="password"
//               value={newPassword}
//               onChange={(e) => setNewPassword(e.target.value)}
//               className="bg-black border-white/30 text-white h-10"
//             />
//             {passwordFieldErrors.newPassword && (
//               <p className="text-xs text-red-400">
//                 {passwordFieldErrors.newPassword}
//               </p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="confirmPassword">Confirm new password</Label>
//             <Input
//               id="confirmPassword"
//               type="password"
//               value={confirmPassword}
//               onChange={(e) => setConfirmPassword(e.target.value)}
//               className="bg-black border-white/30 text-white h-10"
//             />
//             {passwordFieldErrors.confirmPassword && (
//               <p className="text-xs text-red-400">
//                 {passwordFieldErrors.confirmPassword}
//               </p>
//             )}
//           </div>

//           {passwordMessage && (
//             <p className="text-xs text-white/70">{passwordMessage}</p>
//           )}

//           <Button
//             type="submit"
//             disabled={passwordPending}
//             className="rounded-full bg-white text-black hover:bg-white/90 font-semibold h-10 px-6 text-sm"
//           >
//             {passwordPending ? "Updating..." : "Update password"}
//           </Button>
//         </form>
//       </section>

//       {/* DANGER ZONE */}
//       <section className="rounded-2xl border border-red-500/40 bg-[#1a0204] p-5 space-y-3">
//         <h2 className="text-lg font-semibold text-red-400">Danger zone</h2>
//         <p className="text-xs text-red-200/80">
//           Deleting your account will permanently remove your profile and every
//           upload you&apos;ve created. This action cannot be undone.
//         </p>
//         <Button
//           type="button"
//           onClick={() => setDeleteOpen(true)}
//           className="rounded-full border border-red-500 bg-transparent text-red-400 hover:bg-red-500/10 text-sm font-semibold h-10 px-6"
//         >
//           Delete my account
//         </Button>
//       </section>

//       {/* DELETE CONFIRM DIALOG */}
//       <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
//         <DialogContent className="bg-[#111] border border-red-500/40 text-white max-w-sm">
//           <DialogHeader>
//             <DialogTitle className="text-red-400">
//               Delete your account?
//             </DialogTitle>
//           </DialogHeader>
//           <p className="text-sm text-white/80">
//             This will permanently delete your account and all of your uploads.
//             This cannot be undone.
//           </p>
//           {deleteError && (
//             <p className="text-xs text-red-400 mt-2">{deleteError}</p>
//           )}
//           <DialogFooter className="mt-4 flex gap-2 justify-end">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => setDeleteOpen(false)}
//               className="rounded-full h-9 px-4 border-white/30 bg-transparent text-white hover:bg-white/10 text-xs"
//             >
//               Cancel
//             </Button>
//             <Button
//               type="button"
//               onClick={handleDeleteAccount}
//               disabled={deletePending}
//               className="rounded-full h-9 px-4 bg-red-500 text-black hover:bg-red-500/90 text-xs font-semibold"
//             >
//               {deletePending ? "Deleting..." : "Delete account"}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }
