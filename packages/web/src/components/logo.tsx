"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 24 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={cn("inline-block", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="512" height="512" rx="116" fill="#F8FAFC" />
      <path
        d="M106 202 C106 184 120 170 138 170 H394 C412 170 426 184 426 202 V330 C426 374 390 410 346 410 H186 C142 410 106 374 106 330 Z"
        fill="#000000"
        opacity="0.1"
      />
      <linearGradient id="krepza-basket" x1="96" y1="160" x2="416" y2="400" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#22C55E" />
        <stop offset="100%" stopColor="#15803D" />
      </linearGradient>
      <path
        d="M96 192 C96 174 110 160 128 160 H384 C402 160 416 174 416 192 V320 C416 364 380 400 336 400 H176 C132 400 96 364 96 320 Z"
        fill="url(#krepza-basket)"
      />
      <rect x="148" y="292" width="48" height="72" rx="10" fill="#FFFFFF" />
      <rect x="232" y="244" width="48" height="120" rx="10" fill="#FFFFFF" />
      <rect x="316" y="204" width="48" height="160" rx="10" fill="#FFFFFF" />
      <path
        d="M168 160 L276 84 C290 74 309 77 319 91 C329 105 326 124 312 134 L206 208 C182 225 149 221 130 200 C111 179 115 145 138 128 L164 109"
        stroke="#1E293B"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
