// ===== 内置插件注册表 =====
import type { HostDeps, Host } from './host'
import { createHost } from './host'
import { createCloudSyncPlugin } from './cloud-sync'

export function createRegistry(deps: HostDeps): { host: Host; ready: Promise<void> } {
  const host = createHost(deps)
  const ready = (async () => {
    await host.registerPlugin(createCloudSyncPlugin())
  })()
  return { host, ready }
}
