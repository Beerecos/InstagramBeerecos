// Valide la configuration au démarrage du serveur : une erreur arrête le boot avec un message clair.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("./lib/env/schema");
    parseServerEnv(process.env);
  }
}
