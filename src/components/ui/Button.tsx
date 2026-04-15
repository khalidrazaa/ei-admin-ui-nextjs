"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "secondary";
}

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {

  const base =
    "px-2 py-1 rounded text-base font-medium transition-colors";

  const variants = {
    primary: "text-gray-500 rounded border border-green-500 hover:bg-green-900 hover:text-white hover:text-l",
    danger: "text-red-500 hover:bg-red-700 hover:text-gray-200 hover:text-l",
    secondary: "bg-gray-500 w-full rounded border border-green-500 px-2 py-0.5 text-white hover:bg-gray-600",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}