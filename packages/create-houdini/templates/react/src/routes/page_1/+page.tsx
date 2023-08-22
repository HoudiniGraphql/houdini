import type { PageProps } from "./$types";

export default function ({ Page_1 }: PageProps) {
  return (
    <>
      <h2>Page 1</h2>

      <pre>{JSON.stringify(Page_1, null, 2)}</pre>
    </>
  );
}
