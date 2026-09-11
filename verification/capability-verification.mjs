import {CAPABILITY_EVIDENCE} from './capability-evidence.mjs';

export function getCapabilityEvidence(engine,group,id){
  return CAPABILITY_EVIDENCE?.[engine]?.[group]?.[id] ?? null;
}

export function isCapabilityVerificationComplete(engine,group,id){
  const evidence=getCapabilityEvidence(engine,group,id);
  if(!evidence) return false;
  if(!evidence.generator || !evidence.build) return false;
  if(evidence.emulatorRequired!==false && !evidence.emulator) return false;
  if(evidence.physicalRequired && !evidence.physical) return false;
  return true;
}
