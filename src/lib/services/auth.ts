import { apiFetch } from '../api';

// ✅ Types for request/response
export type SendOtpRequest = {
  email: string;
};

export type SendOtpResponse = {
  message: string;
};

export type VerifyOtpRequest = {
  email: string;
  otp: string;
};

export type VerifyOtpResponse = {
  access_token: string;
  token_type: string;
};

// ✅ Functions
export async function sendOtp(payload: SendOtpRequest): Promise<SendOtpResponse> {
  return apiFetch<SendOtpResponse>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyOtp(payload: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  return apiFetch<VerifyOtpResponse>("/auth/verify-otp", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function logout(): Promise<{ status: boolean; message: string }> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include", // ✅ send cookies
  });

  if (!res.ok) {
    throw new Error("Logout failed");
  }
  return res.json();
}