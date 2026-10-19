// Lecture de la configuration : variables d'environnement, puis fichier .env à la racine.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let dotenv;

function loadDotenv() {
  if (dotenv) return dotenv;
  dotenv = {};
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) dotenv[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {
    // Pas de .env : on se contente des variables d'environnement (cas Vercel).
  }
  return dotenv;
}

export function env(name, fallback) {
  const v = process.env[name] ?? loadDotenv()[name];
  if (v !== undefined && v !== '') return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Variable manquante : ${name} (voir .env.example)`);
}

export const ROOT_DIR = ROOT;
