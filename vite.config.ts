import { defineConfig, loadEnv, PluginOption, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { spawn } from 'node:child_process';
import basicSsl from '@vitejs/plugin-basic-ssl'
import {
  buildRouterEditorUrl,
  formatRouterLogLine,
  parseRouterIpOutput,
  resolvePythonCommand,
  shouldEnableRouterLink,
} from './scripts/router-dev-link-utils.mjs';
import {
  DEV_BOOT_PROGRESS_EVENT,
  normalizeDevBootProgressDetail,
} from './src/editor/dev-boot-progress.ts';
import { createClientModuleLoadErrorPlugin } from './src/server/client-module-load-error.ts';
import { createProjectApiPlugin } from './src/server/project-api.ts';

const srcDir = path.resolve(__dirname, 'src').replace(/\\/g, '/');
const chunkSizeLimitInBytes = 5 * 1024 * 1024;
const chunkSizeBypassMatchers = [/onnxruntime-web/, /visionary-core\.umd/];
const routerIpScript = path.resolve(__dirname, 'scripts/get-router-ip.py');

const sanitizeChunkName = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '-');

function resolveServerPort(server: ViteDevServer): string {
  const resolvedNetworkUrl = server.resolvedUrls?.network[0];
  if (resolvedNetworkUrl) {
    return new URL(resolvedNetworkUrl).port || '3000';
  }
  const configuredPort = server.config.server.port;
  return String(configuredPort || 3000);
}

function printRouterLink(server: ViteDevServer, env: Record<string, string>) {
  if (!shouldEnableRouterLink(env)) {
    return;
  }

  const python = resolvePythonCommand();
  if (!python) {
    server.config.logger.info(formatRouterLogLine('unavailable (python not found)'));
    return;
  }

  const protocol = server.config.server.https ? 'https' : 'http';
  const port = resolveServerPort(server);
  const child = spawn(python, [routerIpScript], {
    cwd: __dirname,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  child.on('error', (error) => {
    server.config.logger.info(formatRouterLogLine(`unavailable (${error.name})`));
  });
  child.on('close', () => {
    const parsed = parseRouterIpOutput(stdout || stderr);
    if (parsed.ok) {
      server.config.logger.info(
        formatRouterLogLine(
          buildRouterEditorUrl({
            host: parsed.ip,
            port,
            protocol,
          })
        )
      );
      return;
    }
    server.config.logger.info(formatRouterLogLine(`unavailable (${parsed.reason})`));
  });
}

const routerDevLinkPlugin = (env: Record<string, string>): PluginOption => ({
  name: 'router-dev-link',
  apply: 'serve',
  configureServer(server) {
    let printed = false;
    const printOnce = () => {
      if (printed) {
        return;
      }
      printed = true;
      printRouterLink(server, env);
    };

    if (server.httpServer) {
      server.httpServer.once('listening', printOnce);
    }
  },
});

const devBootProgressPlugin = (): PluginOption => ({
  name: 'visionary-dev-boot-progress',
  apply: 'serve',
  configureServer(server) {
    server.ws.on(DEV_BOOT_PROGRESS_EVENT, (payload) => {
      const detail = normalizeDevBootProgressDetail(payload?.detail);
      if (!detail) return;

      server.config.logger.info(`[visionary] ${detail}`, { timestamp: true });
    });
  },
});

function resolveDevHttpsOptions(env: Record<string, string>) {
  const enabled = env.VISIONARY_DEV_HTTPS === '1' || env.VISIONARY_DEV_HTTPS === 'true';
  if (!enabled) {
    return undefined;
  }

  const certFile = env.VISIONARY_DEV_CERT_FILE || 'certs/dev-server-cert.pem';
  const keyFile = env.VISIONARY_DEV_KEY_FILE || 'certs/dev-server-key.pem';
  const certPath = path.resolve(__dirname, certFile);
  const keyPath = path.resolve(__dirname, keyFile);

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error(
      [
        'VISIONARY_DEV_HTTPS is enabled, but the local HTTPS certificate files were not found.',
        `Expected cert: ${certPath}`,
        `Expected key: ${keyPath}`,
        'Generate and trust a local certificate first, or disable VISIONARY_DEV_HTTPS.',
      ].join('\n')
    );
  }

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}

const enforceChunkSizeLimit = (): PluginOption => ({
  name: 'enforce-chunk-size-limit',
  apply: 'build',
  generateBundle(_options, bundle) {
    Object.entries(bundle).forEach(([fileName, output]) => {
      if (output.type === 'chunk') {
        if (chunkSizeBypassMatchers.some((matcher) => matcher.test(fileName))) {
          return;
        }
        const size = Buffer.byteLength(output.code, 'utf8');
        if (size > chunkSizeLimitInBytes) {
          const sizeInMb = (size / (1024 * 1024)).toFixed(2);
          this.error(
            `输出的 chunk "${fileName}" 大小为 ${sizeInMb} MB，超过 5MB 限制，请调整 manualChunks 或进行代码拆分。`
          );
        }
      }
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isHttps =
    env.VISIONARY_DEV_HTTPS === '1' ||
    env.VISIONARY_DEV_HTTPS === 'true' ||
    mode === 'development';
  const devHttps = resolveDevHttpsOptions(env);

  return {
    server: {
      host: '0.0.0.0',
      port: 3000,
      https: isHttps ? (devHttps ?? {}) : undefined,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    preview: {
      host: '0.0.0.0',
    },
    build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 5120,
    // 构建为库模式
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'VisionaryCore',
      fileName: (format) => `visionary-core.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // 确保外部依赖不会被打包进库中
      // external: ['three', 'gl-matrix', 'onnxruntime-web'],
      external: [/^three(\/.*)?$/, 'gl-matrix', /^onnxruntime-web(\/.*)?$/],
      output: [
        {
          format: 'es',
          entryFileNames: 'visionary-core.es.js',
          chunkFileNames: 'visionary-core.[name].js',
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('/node_modules/three/')) {
              return 'three';
            }
            if (normalizedId.includes('/node_modules/gl-matrix/')) {
              return 'gl-matrix';
            }
            // if (normalizedId.includes('/node_modules/onnxruntime-web/')) {
            //   return 'onnxruntime-web';
            // }
            if (normalizedId.startsWith(srcDir)) {
              const relative = normalizedId.slice(srcDir.length + 1);
              const seg = relative.split('/')[0];
              if (seg) {
                return sanitizeChunkName(`src-${seg}`);
              }
            }
            if (normalizedId.includes('/node_modules/')) {
              const [, remainder] = normalizedId.split('/node_modules/');
              const match = remainder.match(/^(@[^/]+\/[^/]+|[^/]+)/);
              if (match) {
                return sanitizeChunkName(`vendor-${match[1]}`);
              }
            }
          }
        },
        {
          format: 'umd',
          entryFileNames: 'visionary-core.umd.js',
          name: 'VisionaryCore',
          inlineDynamicImports: true,
          globals: {
            'three': 'THREE',
            'three/webgpu': 'THREE',
            'three/examples/jsm/loaders/GLTFLoader.js': 'THREE.GLTFLoader',
            'three/examples/jsm/loaders/OBJLoader.js': 'THREE.OBJLoader',
            'three/examples/jsm/loaders/FBXLoader.js': 'THREE.FBXLoader',
            'three/examples/jsm/loaders/STLLoader.js': 'THREE.STLLoader',
            'three/examples/jsm/loaders/PLYLoader.js': 'THREE.PLYLoader',
            'gl-matrix': 'glMatrix',
            'onnxruntime-web': 'ort',
            'onnxruntime-web/webgpu': 'ort'
          }
        }
      ]
    }
  },
    plugins: [
      enforceChunkSizeLimit(),
      basicSsl(),
      routerDevLinkPlugin(env),
      devBootProgressPlugin(),
      createClientModuleLoadErrorPlugin(),
      createProjectApiPlugin(),
    ],
    publicDir: 'public',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    assetsInclude: ['**/*.wgsl', '**/*.ply'],
  };
});
