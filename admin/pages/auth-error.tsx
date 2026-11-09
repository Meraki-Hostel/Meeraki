export default function AuthError() {
  return (
    <main>
      <h1>Access denied</h1>
      <p>That Google account isn&apos;t on the StayPookie admin allowlist.</p>
      <a href="/api/auth/signin">Try a different account</a>
    </main>
  );
}
