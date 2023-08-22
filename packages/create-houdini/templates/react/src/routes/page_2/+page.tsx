import type { PageProps } from "./$types";

export default function ({ Page_2 }: PageProps) {
  return (
    <>
      <h2>Page 2</h2>

      <pre>{JSON.stringify(Page_2, null, 2)}</pre>
    </>
  );
}
