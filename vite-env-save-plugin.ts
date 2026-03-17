import type { Plugin } from 'vite';
import fs from 'fs/promises';
import path from 'path';

interface EnvSavePluginOptions {
  envFile?: string;
}

export function envSavePlugin(options: EnvSavePluginOptions = {}): Plugin {
  const envFile = options.envFile || '.env.local';

  return {
    name: 'vite-plugin-env-save',
    configureServer(server) {
      server.middlewares.use('/api/save-env', async (req, res) => {
        // 只处理 POST 请求
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
          return;
        }

        try {
          // 读取请求体
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const { content } = JSON.parse(body);

              if (!content || typeof content !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Invalid content' }));
                return;
              }

              // 写入 .env.local 文件
              const envPath = path.resolve(process.cwd(), envFile);
              await fs.writeFile(envPath, content, 'utf-8');

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: `Configuration saved to ${envFile}`,
                path: envPath
              }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to save configuration'
              }));
            }
          });
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
          }));
        }
      });
    },
  };
}
