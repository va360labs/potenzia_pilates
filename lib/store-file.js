import fs from 'node:fs';
import path from 'node:path';

// La despensa original de la demo: un fichero JSON en el disco del servidor.
// En Coolify hace falta un volumen persistente en la carpeta data/ o cada despliegue la vacía.
export function fileStore(file) {
  return {
    async load() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    },
    async save(state) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 2));
    },
  };
}
