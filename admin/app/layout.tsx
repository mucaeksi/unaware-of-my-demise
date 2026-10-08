import "./globals.css";

export const metadata = { title: "UOMD Operations", description: "Unaware of My Demise operator panel" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
