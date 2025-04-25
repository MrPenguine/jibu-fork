import './global.css';

export const metadata = {
  title: 'Jibu AI Console',
  description: 'Jibu AI Console Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
