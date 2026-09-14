import assert from 'node:assert/strict';

import {
  CAPABILITY_STATUS,
  ENGINE_CAPABILITIES
} from '../capabilities.mjs';

const experimental=[];

for(const [engine,groups] of Object.entries(ENGINE_CAPABILITIES)){
  for(const [group,entries] of Object.entries(groups)){
    for(const [id,capability] of Object.entries(entries)){
      if(capability.status===CAPABILITY_STATUS.EXPERIMENTAL){
        experimental.push(`${engine}/${group}/${id}`);
      }
    }
  }
}

assert.deepEqual(
  experimental,
  [],
  `Selectable implemented capabilities must not remain Experimental after accepted physical-device verification. Remaining: ${experimental.join(', ')}`
);

console.log('✓ no implemented/selectable capability remains Experimental');
