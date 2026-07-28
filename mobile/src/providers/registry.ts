import type { SourceId } from '@conductor-companion/shared';
import type { WorkspaceProvider } from './types';
import { bridgeProvider } from './bridge/provider';
import { cloudProvider } from './cloud/provider';

export const providers: Record<SourceId, WorkspaceProvider> = {
  bridge: bridgeProvider,
  cloud: cloudProvider,
};

export function configuredProviders(): WorkspaceProvider[] {
  return Object.values(providers).filter((p) => p.isConfigured());
}
