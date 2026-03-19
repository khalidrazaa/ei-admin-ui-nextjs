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
    primary: "bg-green-600 text-white hover:bg-white text-gray-600 hover:text-gray-800",
    danger: "bg-red-600 text-white hover:bg-white-700",
    secondary: "bg-gray-500 text-white hover:bg-gray-600",
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