/**
 * Grant Source Adapter Factory
 *
 * Creates the appropriate adapter based on source configuration
 */

import { BaseGrantAdapter } from './BaseGrantAdapter.js';
import { GrantsGovAdapter } from './GrantsGovAdapter.js';
import { OpenGrantsAdapter } from './OpenGrantsAdapter.js';
import { CustomGrantAdapter } from './CustomGrantAdapter.js';
import type { GrantSource } from '../types.js';

export * from './BaseGrantAdapter.js';
export * from './GrantsGovAdapter.js';
export * from './OpenGrantsAdapter.js';
export * from './CustomGrantAdapter.js';

/**
 * Create an adapter for the given source
 */
export function createAdapter(source: GrantSource, apiKey?: string): BaseGrantAdapter {
  switch (source.source_key) {
    case 'grants_gov':
      return new GrantsGovAdapter(source, apiKey);

    case 'opengrants':
      return new OpenGrantsAdapter(source, apiKey);

    case 'custom':
    case 'ca_state_portal': // State portals treated like custom for now
      return new CustomGrantAdapter(source, apiKey);

    default:
      throw new Error(`Unknown source type: ${source.source_key}`);
  }
}

/**
 * Get all available adapter types
 */
export function getAvailableAdapters(): Array<{ key: string; name: string; type: string }> {
  return [
    { key: 'grants_gov', name: 'Grants.gov', type: 'federal' },
    { key: 'opengrants', name: 'OpenGrants', type: 'federal' },
    { key: 'custom', name: 'Custom/Manual Entry', type: 'custom' },
  ];
}
