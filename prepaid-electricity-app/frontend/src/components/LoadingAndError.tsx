export function Loading({ label = "Loading..." }: { label?: string }) {
  return <div className="spinner">{label}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}
