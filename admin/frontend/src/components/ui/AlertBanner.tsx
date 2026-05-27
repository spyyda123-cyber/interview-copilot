import Link from "next/link";

type AlertBannerProps = {
  message: string;
  variant?: "warning" | "danger" | "info";
  linkText?: string;
  linkHref?: string;
};

export default function AlertBanner({ message, variant = "info", linkText, linkHref }: AlertBannerProps) {
  const style =
    variant === "warning"
      ? "border-[#fcd34d] bg-[#fff8e1] text-[#b45309]"
      : variant === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[#d9f36e] bg-[#f7ffe0] text-[#222222]";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>
      <span>{message}</span>
      {linkText && linkHref ? (
        <Link href={linkHref} className="ml-2 font-semibold underline">
          {linkText}
        </Link>
      ) : null}
    </div>
  );
}
