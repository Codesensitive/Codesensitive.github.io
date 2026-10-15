import assert from 'node:assert/strict';
import {prebuiltAppConfig} from '@mlc-ai/web-llm';
import {LLM_MODELS} from '../dist/llm-models.js';
for(const model of Object.values(LLM_MODELS)){
  const record=prebuiltAppConfig.model_list.find(item=>item.model_id===model.id);
  assert.ok(record,model.id);
  const response=await fetch(`${record.model}/resolve/main/ndarray-cache.json`);
  assert.ok(response.ok,`Manifest unavailable: ${model.id}`);
  const manifest=await response.json();
  assert.equal(manifest.records.reduce((sum,shard)=>sum+shard.nbytes,0),model.bytes);
  assert.ok(Math.abs(record.vram_required_MB-model.vram)<1);
  console.log(`${model.id}: download bytes and VRAM verified`);
}
