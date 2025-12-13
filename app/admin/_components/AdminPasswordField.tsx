"use client";

import { useState } from "react";

type Props = {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
};

export function AdminPasswordField({
  label,
  name,
  required,
  placeholder,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1">
      <label className="block text-xs text-white/70">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          required={required}
          placeholder={placeholder}
          className="w-full h-9 rounded-md bg-black/40 border border-white/20 px-3 pr-10 text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-2 flex items-center text-[11px] text-white/60 hover:text-white"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
