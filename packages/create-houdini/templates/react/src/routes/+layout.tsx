import { Link } from "$houdini";

import type { LayoutProps } from "./$types";

export default function ({ children }: LayoutProps) {
  return (
    <>
      <h1>Welcome to Houdini & React</h1>
      <hr />
      <Link href="/">Home</Link> | <Link href="/page_1">Page 1</Link> |
      <Link href="/page_2">Page 2</Link>
      <hr />
      <div>{children}</div>
      <footer style={{ textAlign: "center" }}>
        <i>
          //Made with 🧡 - Join us on&nbsp;
          <a href="https://github.com/HoudiniGraphql/houdini">GitHub</a>⭐
        </i>
      </footer>
    </>
  );
}
