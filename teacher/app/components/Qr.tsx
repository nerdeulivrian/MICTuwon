// QR image — renders a scannable code for the given value (a tuwon share link).
"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function Qr({ value, size = 72 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 3,
      color: { dark: "#4B4B4B", light: "#FFFFFF" },
    })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!src) return <div style={{ width: size, height: size }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="Session QR code" />;
}
