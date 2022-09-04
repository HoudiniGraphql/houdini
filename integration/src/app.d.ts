// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare namespace App {
  // interface Locals {}

  // interface Platform {}

  interface Session {
    user?: {
      token: string;
    };
  }

  // interface Stuff {}

  interface Metadata {
    logResult?: boolean | null;
  }
}
