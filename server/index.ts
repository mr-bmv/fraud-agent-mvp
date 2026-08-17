import app from '../api/index.js';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT ?? 3001);

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

export default app;
