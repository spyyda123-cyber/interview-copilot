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
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : variant === "danger"
      ? "border-red-300 bg-red-50 text-red-800"
      : "border-blue-300 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>
      <span>{message}</span>
      {linkText && linkHref ? (
        <Link href={linkHref} className="ml-2 font-medium underline">
          {linkText}
        </Link>
      ) : null}
    </div>
  );
}
