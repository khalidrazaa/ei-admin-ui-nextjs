"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendOtp, verifyOtp } from "../../../lib/services/auth";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpInvalid, setOtpInvalid] = useState(false);
  const [message, setMessage] = useState("");

  // Send OTP
  async function handleSendOtp() {
    if (!email) {
      setError("Please enter your email");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setOtp("");

    try {
      const res = await sendOtp({ email });
      setMessage(res.message || "OTP sent successfully");
      setStep("otp");
      setOtpInvalid(false);
      setTimeout(() => setMessage(""), 10000);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Failed to send OTP");
      else setError("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  // Verify OTP
  async function handleVerifyOtp() {
    if (!otp) {
      setError("Please enter the OTP");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await verifyOtp({ email, otp });
      localStorage.setItem("access_token", res.access_token);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Invalid OTP");
      else setError("Invalid OTP");
      setOtpInvalid(true); // enable Resend OTP
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100" style={{ minHeight: "calc(100vh - 110px)" }}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Admin Login</h1>

        {/* Email Field */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Email</label>
          <div className="flex">
            <input
              type="email"
              className="flex-1 rounded-l-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || step === "otp"}
            />
            <button
              onClick={handleSendOtp}
              disabled={loading || !email}
              className="w-32 rounded-r-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {step === "email" && loading ? "Sending..." : "Get OTP"}
            </button>
          </div>
          <div className="mt-2 h-6">
            {message && (
              <div className="rounded bg-green-100 p-1 text-sm text-green-700">{message}</div>
            )}
            {error && step === "email" && (
              <div className="rounded bg-red-100 p-1 text-sm text-red-700">{error}</div>
            )}
          </div>
        </div>

        {/* OTP Section */}
        {step === "otp" && (
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">OTP</label>
            <div className="flex">
              <input
                type="text"
                className="flex-1 rounded-l-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button
                onClick={handleSendOtp}
                disabled={!otpInvalid || loading}
                className="w-32 rounded-r-md bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 disabled:bg-gray-400"
              >
                Resend OTP
              </button>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="mt-4 w-full rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <div className="mt-2 h-6">
              {error && step === "otp" && (
                <div className="rounded bg-red-100 p-1 text-sm text-red-700">{error}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
